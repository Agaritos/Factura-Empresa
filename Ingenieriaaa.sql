CREATE DATABASE SistemaVentasBelleza;
GO

USE SistemaVentasBelleza;
GO


CREATE TABLE Usuarios (
    id_usuario INT IDENTITY(1,1) PRIMARY KEY,
    nombre NVARCHAR(100) NOT NULL,
    rol NVARCHAR(20) NOT NULL CHECK (rol IN ('administrador', 'vendedor')),
    contraseña NVARCHAR(255) NOT NULL
);


CREATE TABLE Productos (
    id_producto INT IDENTITY(1,1) PRIMARY KEY,
    nombre NVARCHAR(100) NOT NULL,
    marca NVARCHAR(100),
    categoria NVARCHAR(50),
    precio DECIMAL(10,2) NOT NULL CHECK (precio > 0)
);


CREATE TABLE Ventas (
    id_venta INT IDENTITY(1,1) PRIMARY KEY,
    fecha DATETIME DEFAULT GETDATE(),
    id_usuario INT NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (id_usuario) REFERENCES Usuarios(id_usuario)
);


CREATE TABLE Detalle_Venta (
    id_detalle INT IDENTITY(1,1) PRIMARY KEY,
    id_venta INT NOT NULL,
    id_producto INT NOT NULL,
    cantidad INT NOT NULL CHECK (cantidad > 0),
    precio_unitario DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (id_venta) REFERENCES Ventas(id_venta),
    FOREIGN KEY (id_producto) REFERENCES Productos(id_producto)
);


CREATE TABLE Facturas (
    id_factura INT IDENTITY(1,1) PRIMARY KEY,
    id_venta INT NOT NULL UNIQUE,
    fecha DATETIME DEFAULT GETDATE(),
    total DECIMAL(10,2),
    FOREIGN KEY (id_venta) REFERENCES Ventas(id_venta)
);


INSERT INTO Usuarios (nombre, rol, contraseña) VALUES
('Ana Lopez', 'administrador', '1234'),
('Carlos Perez', 'vendedor', '1234'),
('Maria Gomez', 'vendedor', '1234'),
('Luis Torres', 'vendedor', '1234'),
('Sofia Ramirez', 'administrador', '1234'),
('Pedro Diaz', 'vendedor', '1234'),
('Laura Castro', 'vendedor', '1234'),
('Jorge Ruiz', 'vendedor', '1234'),
('Elena Vargas', 'administrador', '1234'),
('Diego Herrera', 'vendedor', '1234');


INSERT INTO Productos (nombre, marca, categoria, precio) VALUES
('Labial Mate', 'Maybelline', 'Maquillaje', 25000),
('Base Liquida', 'LOréal', 'Maquillaje', 45000),
('Rimel', 'MAC', 'Maquillaje', 38000),
('Crema Facial', 'Nivea', 'Cuidado', 30000),
('Perfume Floral', 'Dior', 'Fragancia', 120000),
('Esmalte Rojo', 'OPI', 'Uñas', 15000),
('Shampoo Reparador', 'Pantene', 'Cabello', 28000),
('Acondicionador', 'Sedal', 'Cabello', 26000),
('Protector Solar', 'La Roche', 'Cuidado', 60000),
('Gel Fijador', 'Gatsby', 'Cabello', 20000);



INSERT INTO Ventas (id_usuario, total) VALUES
(2, 50000),
(3, 80000),
(4, 120000),
(5, 30000),
(6, 45000),
(7, 70000),
(8, 95000),
(9, 60000),
(10, 40000),
(2, 110000);


INSERT INTO Detalle_Venta (id_venta, id_producto, cantidad, precio_unitario) VALUES
(1, 1, 2, 25000),
(2, 2, 1, 45000),
(3, 5, 1, 120000),
(4, 4, 1, 30000),
(5, 6, 3, 15000),
(6, 7, 2, 28000),
(7, 3, 2, 38000),
(8, 9, 1, 60000),
(9, 10, 2, 20000),
(10, 1, 4, 25000);


INSERT INTO Facturas (id_venta, total) VALUES
(1, 50000),
(2, 80000),
(3, 120000),
(4, 30000),
(5, 45000),
(6, 70000),
(7, 95000),
(8, 60000),
(9, 40000),
(10, 110000);