const path = require('path');
const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 3000;
const JWT_SECRET = '1012331673'; 
// Configuración de la base de datos
const dbConfig = {
  user: 'sa',
  password: '1012331673',
  server: 'localhost',
  database: 'SistemaVentasBelleza',
  options: {
    port: 1433,
    encrypt: false,
    trustServerCertificate: true
  }
};

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Servir archivos estáticos desde la carpeta del servidor

// Conectar a la base de datos
sql.connect(dbConfig).then(() => {
  console.log('Conectado a SQL Server');
}).catch(err => {
  console.error('Error conectando a la base de datos:', err);
});

// Middleware para verificar token
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token requerido' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });
    req.user = decoded;
    next();
  });
}

// Endpoint de login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('nombre', sql.NVarChar, username)
      .query('SELECT * FROM Usuarios WHERE nombre = @nombre');

    if (result.recordset.length === 0) {
      return res.status(401).json({ message: 'Usuario no encontrado' });
    }

    const user = result.recordset[0];
    // Para este ejemplo, las contraseñas están en texto plano
    if (password !== user.contraseña) {
      return res.status(401).json({ message: 'Contraseña incorrecta' });
    }

    const token = jwt.sign({ id: user.id_usuario, role: user.rol }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ user: { username: user.nombre, role: user.rol }, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Endpoint para obtener ventas
app.get('/api/sales', verifyToken, async (req, res) => {
  const filter = req.query.filter || 'all';
  try {
    const pool = await sql.connect(dbConfig);
    const query = `
      SELECT v.id_venta, v.fecha, u.nombre as usuario,
             SUM(ISNULL(dv.cantidad * dv.precio_unitario, 0)) as total,
             SUM(ISNULL(dv.cantidad, 0)) as items
      FROM Ventas v
      JOIN Usuarios u ON v.id_usuario = u.id_usuario
      LEFT JOIN Detalle_Venta dv ON v.id_venta = dv.id_venta
      GROUP BY v.id_venta, v.fecha, u.nombre
      ORDER BY v.fecha DESC
    `;
    const result = await pool.request().query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error obteniendo ventas' });
  }
});

// Endpoint para obtener detalles de una venta
app.get('/api/sales/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await sql.connect(dbConfig);
    const saleResult = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT v.id_venta, v.fecha, u.nombre as usuario,
               SUM(ISNULL(dv.cantidad * dv.precio_unitario, 0)) as total
        FROM Ventas v
        JOIN Usuarios u ON v.id_usuario = u.id_usuario
        LEFT JOIN Detalle_Venta dv ON v.id_venta = dv.id_venta
        WHERE v.id_venta = @id
        GROUP BY v.id_venta, v.fecha, u.nombre
      `);

    if (!saleResult.recordset.length) {
      return res.status(404).json({ message: 'Venta no encontrada' });
    }

    const detailResult = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT dv.id_detalle, p.nombre, dv.cantidad, dv.precio_unitario
        FROM Detalle_Venta dv
        JOIN Productos p ON dv.id_producto = p.id_producto
        WHERE dv.id_venta = @id
      `);

    const sale = saleResult.recordset[0];
    const items = detailResult.recordset.map(item => ({
      nombre: item.nombre,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario
    }));

    res.json({ ...sale, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error obteniendo detalles de la venta' });
  }
});

// Endpoint para crear venta
app.post('/api/sales', verifyToken, async (req, res) => {
  const { items, total, payment, client } = req.body;
  const user = req.user;
  try {
    const pool = await sql.connect(dbConfig);
    // Insertar venta
    const ventaResult = await pool.request()
      .input('id_usuario', sql.Int, user.id)
      .input('total', sql.Decimal(10,2), total)
      .query('INSERT INTO Ventas (id_usuario, total) OUTPUT INSERTED.id_venta VALUES (@id_usuario, @total)');
    
    const id_venta = ventaResult.recordset[0].id_venta;
    
    // Insertar detalles
    for (const item of items) {
      await pool.request()
        .input('id_venta', sql.Int, id_venta)
        .input('id_producto', sql.Int, parseInt(item.id))
        .input('cantidad', sql.Int, item.quantity)
        .input('precio_unitario', sql.Decimal(10,2), item.price)
        .query('INSERT INTO Detalle_Venta (id_venta, id_producto, cantidad, precio_unitario) VALUES (@id_venta, @id_producto, @cantidad, @precio_unitario)');
    }
    
    res.status(201).json({ id_venta });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creando venta' });
  }
});

// Endpoint para obtener inventario
app.get('/api/inventory', verifyToken, async (req, res) => {
  const search = req.query.search;
  try {
    const pool = await sql.connect(dbConfig);
    let query = 'SELECT * FROM Productos';
    const request = pool.request();
    if (search) {
      query += ' WHERE nombre LIKE @search OR marca LIKE @search OR categoria LIKE @search';
      request.input('search', sql.NVarChar, `%${search}%`);
    }
    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error obteniendo inventario' });
  }
});

// Endpoint para agregar producto
app.post('/api/inventory', verifyToken, async (req, res) => {
  const { nombre, marca, categoria, precio, stock } = req.body;
  try {
    const pool = await sql.connect(dbConfig);
    await pool.request()
      .input('nombre', sql.NVarChar, nombre)
      .input('marca', sql.NVarChar, marca || null)
      .input('categoria', sql.NVarChar, categoria || null)
      .input('precio', sql.Decimal(10,2), precio)
      .input('stock', sql.Int, stock || 100)
      .query('INSERT INTO Productos (nombre, marca, categoria, precio, stock) VALUES (@nombre, @marca, @categoria, @precio, @stock)');
    res.status(201).json({ message: 'Producto agregado' });
  } catch (err) {
    console.error('Error agregando producto:', err);
    res.status(500).json({ message: 'Error agregando producto' });
  }
});

// Endpoint para actualizar producto
app.put('/api/inventory/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { nombre, marca, categoria, precio, stock } = req.body;
  try {
    const pool = await sql.connect(dbConfig);
    await pool.request()
      .input('id', sql.Int, id)
      .input('nombre', sql.NVarChar, nombre)
      .input('marca', sql.NVarChar, marca || null)
      .input('categoria', sql.NVarChar, categoria || null)
      .input('precio', sql.Decimal(10,2), precio)
      .input('stock', sql.Int, stock || 100)
      .query('UPDATE Productos SET nombre = @nombre, marca = @marca, categoria = @categoria, precio = @precio, stock = @stock WHERE id_producto = @id');
    res.json({ message: 'Producto actualizado' });
  } catch (err) {
    console.error('Error actualizando producto:', err);
    res.status(500).json({ message: 'Error actualizando producto' });
  }
});

// Endpoint para eliminar producto
app.delete('/api/inventory/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await sql.connect(dbConfig);
    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM Productos WHERE id_producto = @id');
    res.json({ message: 'Producto eliminado' });
  } catch (err) {
    console.error('Error eliminando producto:', err);
    res.status(500).json({ message: 'Error eliminando producto' });
  }
});

// Endpoint para estadísticas de inventario
app.get('/api/inventory/stats', verifyToken, async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const columnCheck = await pool.request()
      .input('tableName', sql.NVarChar, 'Productos')
      .input('columnName', sql.NVarChar, 'stock')
      .query(`
        SELECT COUNT(*) as stockExists
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = @tableName
          AND COLUMN_NAME = @columnName
      `);

    const stockExists = columnCheck.recordset[0].stockExists > 0;
    const result = await pool.request().query(`
      SELECT
        COUNT(*) as total,
        SUM(precio * ${stockExists ? 'ISNULL(stock, 1)' : '1'}) as valor_total,
        SUM(CASE WHEN ${stockExists ? 'ISNULL(stock, 1)' : '1'} < 10 THEN 1 ELSE 0 END) as bajos_stock
      FROM Productos
    `);
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Error obteniendo estadísticas:', err);
    res.status(500).json({ message: 'Error obteniendo estadísticas' });
  }
});

// Endpoint para generar factura (simulado)
app.post('/api/invoices', verifyToken, async (req, res) => {
  // Aquí puedes implementar la lógica para insertar en Facturas
  res.json({ invoiceId: `INV-${Date.now()}`, ...req.body });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});