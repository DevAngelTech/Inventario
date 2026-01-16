alasql("CREATE TABLE IF NOT EXISTS inventario (id INT AUTO_INCREMENT, nombre STRING, categoria STRING, precio MONEY, stock INT)");
alasql("CREATE TABLE IF NOT EXISTS ventas (id INT AUTO_INCREMENT, producto STRING, cantidad INT, total MONEY, fecha STRING)");

let CAJA_CHICA = 0; 
let NOMBRE_ADMIN = "Admin";

cargarDatos();

function cargarDatos() {
    let invGuardado = localStorage.getItem("db_inventario");
    if (invGuardado) {
        let datos = JSON.parse(invGuardado);
        alasql("DELETE FROM inventario");
        datos.forEach(d => alasql("INSERT INTO inventario VALUES (?,?,?,?,?)", [d.id, d.nombre, d.categoria, d.precio, d.stock]));
    } else {
        alasql("INSERT INTO inventario (nombre, categoria, precio, stock) VALUES ('Whey Gold', 'Proteína', 899, 10)");
        alasql("INSERT INTO inventario (nombre, categoria, precio, stock) VALUES ('C4 Pre-workout', 'Pre-entreno', 650, 5)");
    }

    let ventasGuardadas = localStorage.getItem("db_ventas");
    if (ventasGuardadas) {
        let v = JSON.parse(ventasGuardadas);
        alasql("DELETE FROM ventas");
        v.forEach(x => alasql("INSERT INTO ventas VALUES (?,?,?,?,?)", [x.id, x.producto, x.cantidad, x.total, x.fecha]));
    }

    CAJA_CHICA = parseFloat(localStorage.getItem("db_caja")) || 1000;
    NOMBRE_ADMIN = localStorage.getItem("db_admin_nombre") || "Admin";
    
    if(document.getElementById("sidebar-username")) {
        document.getElementById("sidebar-username").innerText = NOMBRE_ADMIN;
        document.getElementById("admin-nombre").value = NOMBRE_ADMIN;
    }
    
    actualizarTodo();
}

function guardarTodo() {
    localStorage.setItem("db_inventario", JSON.stringify(alasql("SELECT * FROM inventario")));
    localStorage.setItem("db_ventas", JSON.stringify(alasql("SELECT * FROM ventas")));
    localStorage.setItem("db_caja", CAJA_CHICA);
    localStorage.setItem("db_admin_nombre", NOMBRE_ADMIN);
}

function actualizarTodo() {
    renderInventario();
    renderVentas();
    actualizarStats();
}

function cambiarSeccion(seccion) {
    document.getElementById("sec-inventario").className = "seccion-oculta";
    document.getElementById("sec-ventas").className = "seccion-oculta";
    document.getElementById("sec-config").className = "seccion-oculta";
    
    document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));

    document.getElementById("sec-" + seccion).className = "seccion-activa";
    document.getElementById("link-" + seccion).classList.add("active");

    if(window.innerWidth < 768) {
        toggleMenu(false);
    }
}

function renderInventario() {
    const tbody = document.getElementById("tabla-inventario");
    tbody.innerHTML = "";
    let productos = alasql("SELECT * FROM inventario ORDER BY id DESC");

    productos.forEach(p => {
        let colorStock = p.stock < 5 ? '#ef4444' : '#334155';
        
        tbody.innerHTML += `
            <tr>
                <td><b>${p.nombre}</b><br><small style="color:#64748b">${p.categoria}</small></td>
                <td>$${p.precio}</td>
                <td style="color:${colorStock}"><b>${p.stock}</b> un.</td>
                <td>
                    <button class="btn-action btn-add" title="Resurtir (+1)" onclick="modificarStock(${p.id}, 1)">+</button>
                    <button class="btn-action btn-sell" title="Vender" onclick="venderProducto(${p.id})">$</button>
                    <button class="btn-delete" title="Eliminar Producto" onclick="eliminarProducto(${p.id})">Borrar</button>
                </td>
            </tr>
        `;
    });
}

function renderVentas() {
    const tbody = document.getElementById("tabla-ventas");
    tbody.innerHTML = "";
    let ventas = alasql("SELECT * FROM ventas ORDER BY id DESC");

    ventas.forEach(v => {
        tbody.innerHTML += `
            <tr>
                <td>#${v.id}</td>
                <td>${v.producto}</td>
                <td>${v.cantidad}</td>
                <td style="color:#10b981; font-weight:bold">+$${v.total}</td>
                <td>${v.fecha}</td>
            </tr>
        `;
    });
}

function actualizarStats() {
    let valorInv = alasql("SELECT SUM(precio * stock) as v FROM inventario")[0].v || 0;
    let ventasTotales = alasql("SELECT SUM(total) as t FROM ventas")[0].t || 0;

    document.getElementById("stat-caja").innerText = `$${CAJA_CHICA.toLocaleString()}`;
    document.getElementById("stat-valor").innerText = `$${valorInv.toLocaleString()}`;
    document.getElementById("stat-ganancias").innerText = `$${ventasTotales.toLocaleString()}`;
}

window.modificarStock = function(id, cantidad) {
    alasql("UPDATE inventario SET stock = stock + ? WHERE id = ?", [cantidad, id]);
    guardarTodo();
    actualizarTodo();
}

window.venderProducto = function(id) {
    let p = alasql("SELECT * FROM inventario WHERE id = ?", [id])[0];
    
    if (p.stock <= 0) {
        alert("¡No hay stock suficiente para vender!");
        return;
    }

    let cantidad = prompt(`Vas a vender: ${p.nombre}. Precio unitario: $${p.precio}.\n\n¿Cuántas piezas llevas?`, "1");
    
    if (cantidad === null) return;
    cantidad = parseInt(cantidad);

    if (cantidad > 0 && cantidad <= p.stock) {
        let totalVenta = cantidad * p.precio;

        alasql("UPDATE inventario SET stock = stock - ? WHERE id = ?", [cantidad, id]);
        
        let fecha = new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString();
        alasql("INSERT INTO ventas (producto, cantidad, total, fecha) VALUES (?,?,?,?)", 
            [p.nombre, cantidad, totalVenta, fecha]);
        
        CAJA_CHICA += totalVenta;

        guardarTodo();
        actualizarTodo();
        
        if(confirm("Venta Exitosa (+$" + totalVenta + "). ¿Ir al historial de ventas?")) {
            cambiarSeccion('ventas');
        }

    } else if (cantidad > p.stock) {
        alert("Error: Solo tienes " + p.stock + " piezas en inventario.");
    }
}

window.eliminarProducto = function(id) {
    if(confirm("¿Seguro que quieres eliminar este producto?")) {
        let pass = prompt(" Acción protegida.\nEscribe la contraseña de administrador:", "admin");
        
        if (pass === "admin") {
            alasql("DELETE FROM inventario WHERE id = ?", [id]);
            guardarTodo();
            actualizarTodo();
            alert("Producto eliminado correctamente.");
        } else {
            alert(" Contraseña incorrecta. No se eliminó el producto.");
        }
    }
}

window.modificarCaja = function() {
    let pass = prompt(" Área restringida.\nEscribe la contraseña de administrador:", "admin"); 
    
    if (pass === "admin") {
        let nuevoMonto = prompt("Saldo actual: $" + CAJA_CHICA + "\nIngresa el nuevo saldo de caja:");
        if (nuevoMonto !== null && !isNaN(nuevoMonto)) {
            CAJA_CHICA = parseFloat(nuevoMonto);
            guardarTodo();
            actualizarStats();
            alert("Caja actualizada correctamente.");
        }
    } else {
        alert(" Contraseña incorrecta.");
    }
}

window.cerrarSesion = function() {
    if(confirm("¿Cerrar sesión de " + NOMBRE_ADMIN + "?")) {
        alert("Sesión cerrada.");
        location.reload(); 
    }
}

window.borrarHistorial = function() {
    let pass = prompt("Confirmar contraseña para BORRAR historial:", "admin");
    if(pass === "admin") {
        alasql("DELETE FROM ventas");
        guardarTodo();
        actualizarTodo();
        alert("Historial limpio.");
    }
}

const formConfig = document.getElementById("form-config");
if(formConfig) {
    formConfig.addEventListener("submit", (e) => {
        e.preventDefault();
        NOMBRE_ADMIN = document.getElementById("admin-nombre").value;
        guardarTodo();
        document.getElementById("sidebar-username").innerText = NOMBRE_ADMIN;
        alert("Datos de perfil actualizados.");
    });
}

const modal = document.getElementById("modal");
const btnAbrir = document.getElementById("btn-abrir-modal");
const spanCerrar = document.querySelector(".close");
const formProd = document.getElementById("form-producto");

if(btnAbrir) btnAbrir.onclick = () => modal.style.display = "block";
if(spanCerrar) spanCerrar.onclick = () => modal.style.display = "none";
window.onclick = (e) => { if (e.target == modal) modal.style.display = "none"; }

if(formProd) {
    formProd.addEventListener("submit", (e) => {
        e.preventDefault();
        let n = document.getElementById("nombre").value;
        let c = document.getElementById("categoria").value;
        let p = parseFloat(document.getElementById("precio").value);
        let s = parseInt(document.getElementById("stock").value);
        
        alasql("INSERT INTO inventario (nombre, categoria, precio, stock) VALUES (?,?,?,?)", [n, c, p, s]);
        guardarTodo();
        actualizarTodo();
        modal.style.display = "none";
        formProd.reset();
    });
}

const btnMenuMovil = document.getElementById("btn-menu-movil");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("mobile-overlay");

function toggleMenu(forceClose = null) {
    if (forceClose === false) {
        sidebar.classList.remove("active");
        overlay.classList.remove("active");
    } else {
        sidebar.classList.toggle("active");
        overlay.classList.toggle("active");
    }
}

if(btnMenuMovil) {
    btnMenuMovil.addEventListener("click", () => toggleMenu());
}

if(overlay) {
    overlay.addEventListener("click", () => toggleMenu(false));
}