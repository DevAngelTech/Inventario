document.addEventListener('DOMContentLoaded', () => {
    
    alasql("CREATE TABLE IF NOT EXISTS inventario (id INT AUTO_INCREMENT, nombre STRING, categoria STRING, precio MONEY, stock INT)");
    alasql("CREATE TABLE IF NOT EXISTS ventas (id INT AUTO_INCREMENT, producto STRING, cantidad INT, total MONEY, fecha STRING)");

    let cajaChica = 0;
    let nombreAdmin = "Admin";
    let usuarioAutenticado = false;

    const ui = {
        loginScreen: document.getElementById("login-screen"),
        formLogin: document.getElementById("form-login"),
        userInput: document.getElementById("login-user"),
        passInput: document.getElementById("login-pass"),
        appContainer: document.getElementById("app-container"),
        sidebarUsername: document.getElementById("sidebar-username"),
        avatarLetra: document.getElementById("avatar-letra"),
        inputAdminNombre: document.getElementById("admin-nombre"),
        statCaja: document.getElementById("stat-caja"),
        statValor: document.getElementById("stat-valor"),
        statGanancias: document.getElementById("stat-ganancias"),
        tablaInventario: document.getElementById("tabla-inventario"),
        tablaVentas: document.getElementById("tabla-ventas"),
        modal: document.getElementById("modal"),
        formProducto: document.getElementById("form-producto"),
        btnAbrirModal: document.getElementById("btn-abrir-modal"),
        btnCerrarModal: document.getElementById("btn-cerrar-modal"),
        btnMenuMovil: document.getElementById("btn-menu-movil"),
        sidebar: document.getElementById("sidebar"),
        overlay: document.getElementById("mobile-overlay"),
        sidebarNav: document.getElementById("sidebar-nav"),
        btnLogout: document.getElementById("btn-logout"),
        btnEditarCaja: document.getElementById("btn-editar-caja"),
        btnBorrarHistorial: document.getElementById("btn-borrar-historial"),
        formConfig: document.getElementById("form-config")
    };

    function init() {
        cargarDatos();
        setupEventListeners();
    }

    function cargarDatos() {
        const invGuardado = localStorage.getItem("db_inventario");
        if (invGuardado) {
            const datos = JSON.parse(invGuardado);
            alasql("DELETE FROM inventario");
            datos.forEach(d => alasql("INSERT INTO inventario VALUES (?,?,?,?,?)", [d.id, d.nombre, d.categoria, d.precio, d.stock]));
        } else {
            alasql("INSERT INTO inventario (nombre, categoria, precio, stock) VALUES ('Whey Gold', 'Proteína', 899, 10)");
            alasql("INSERT INTO inventario (nombre, categoria, precio, stock) VALUES ('C4 Pre-workout', 'Pre-entreno', 650, 5)");
        }

        const ventasGuardadas = localStorage.getItem("db_ventas");
        if (ventasGuardadas) {
            const v = JSON.parse(ventasGuardadas);
            alasql("DELETE FROM ventas");
            v.forEach(x => alasql("INSERT INTO ventas VALUES (?,?,?,?,?)", [x.id, x.producto, x.cantidad, x.total, x.fecha]));
        }

        cajaChica = parseFloat(localStorage.getItem("db_caja")) || 1000;
        actualizarUI();
    }

    function guardarTodo() {
        localStorage.setItem("db_inventario", JSON.stringify(alasql("SELECT * FROM inventario")));
        localStorage.setItem("db_ventas", JSON.stringify(alasql("SELECT * FROM ventas")));
        localStorage.setItem("db_caja", cajaChica);
    }

    function actualizarUI() {
        renderInventario();
        renderVentas();
        actualizarStats();
    }

    function renderInventario() {
        ui.tablaInventario.innerHTML = "";
        const productos = alasql("SELECT * FROM inventario ORDER BY id DESC");

        productos.forEach(p => {
            const colorStock = p.stock < 5 ? '#ef4444' : '#334155';
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><b>${p.nombre}</b><br><small style="color:#64748b">${p.categoria}</small></td>
                <td>$${p.precio}</td>
                <td style="color:${colorStock}"><b>${p.stock}</b> un.</td>
                <td>
                    <button class="btn-action btn-add" data-id="${p.id}" data-action="add" title="Resurtir">+</button>
                    <button class="btn-action btn-sell" data-id="${p.id}" data-action="sell" title="Vender">$</button>
                    <button class="btn-action btn-loss" data-id="${p.id}" data-action="loss" title="Reportar Pérdida">!</button>
                    <button class="btn-delete" data-id="${p.id}" data-action="delete" title="Eliminar">Borrar</button>
                </td>
            `;
            ui.tablaInventario.appendChild(row);
        });
    }

    function renderVentas() {
        ui.tablaVentas.innerHTML = "";
        const ventas = alasql("SELECT * FROM ventas ORDER BY id DESC");

        ventas.forEach(v => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>#${v.id}</td>
                <td>${v.producto}</td>
                <td>${v.cantidad}</td>
                <td style="color:#10b981; font-weight:bold">+$${v.total}</td>
                <td>${v.fecha}</td>
            `;
            ui.tablaVentas.appendChild(row);
        });
    }

    function actualizarStats() {
        const valorInv = alasql("SELECT SUM(precio * stock) as v FROM inventario")[0].v || 0;
        const ventasTotales = alasql("SELECT SUM(total) as t FROM ventas")[0].t || 0;

        ui.statCaja.innerText = `$${cajaChica.toLocaleString()}`;
        ui.statValor.innerText = `$${valorInv.toLocaleString()}`;
        ui.statGanancias.innerText = `$${ventasTotales.toLocaleString()}`;
    }

    function handleStockChange(id, cantidad) {
        alasql("UPDATE inventario SET stock = stock + ? WHERE id = ?", [cantidad, id]);
        guardarTodo();
        actualizarUI();
    }

    function handleVenta(id) {
        const p = alasql("SELECT * FROM inventario WHERE id = ?", [id])[0];
        
        if (p.stock <= 0) {
            alert("¡No hay stock suficiente para vender!");
            return;
        }

        const input = prompt(`Vas a vender: ${p.nombre}. Precio unitario: $${p.precio}.\n\n¿Cuántas piezas llevas?`, "1");
        if (input === null) return;
        
        const cantidad = parseInt(input);

        if (cantidad > 0 && cantidad <= p.stock) {
            const totalVenta = cantidad * p.precio;
            const fecha = new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString();

            alasql("UPDATE inventario SET stock = stock - ? WHERE id = ?", [cantidad, id]);
            alasql("INSERT INTO ventas (producto, cantidad, total, fecha) VALUES (?,?,?,?)", [p.nombre, cantidad, totalVenta, fecha]);
            
            cajaChica += totalVenta;
            guardarTodo();
            actualizarUI();
            
            if(confirm(`Venta Exitosa (+$${totalVenta}). ¿Ir al historial?`)) {
                changeSection('ventas');
            }

        } else if (cantidad > p.stock) {
            alert(`Error: Solo tienes ${p.stock} piezas.`);
        }
    }

    function handlePerdida(id) {
        const pass = prompt("REPORTAR PÉRDIDA (ADMIN)\n\nIngrese contraseña:", "admin");
        if (pass !== "admin") return alert("Acceso denegado.");

        const p = alasql("SELECT * FROM inventario WHERE id = ?", [id])[0];
        const input = prompt(`Reportando merma de: ${p.nombre}\n\n¿Cantidad perdida?`, "1");
        if (input === null) return;

        const cantidad = parseInt(input);

        if (cantidad > 0 && cantidad <= p.stock) {
            const perdidaTotal = cantidad * p.precio;
            alasql("UPDATE inventario SET stock = stock - ? WHERE id = ?", [cantidad, id]);
            cajaChica -= perdidaTotal;
            guardarTodo();
            actualizarUI();
            alert(`Reporte Exitoso. Descontado: $${perdidaTotal}`);
        } else {
            alert("Error en la cantidad.");
        }
    }

    function handleDelete(id) {
        if(!confirm("¿Eliminar este producto permanentemente?")) return;
        
        const pass = prompt("ACCIÓN PROTEGIDA\n\nContraseña:", "admin");
        if (pass === "admin") {
            alasql("DELETE FROM inventario WHERE id = ?", [id]);
            guardarTodo();
            actualizarUI();
        } else {
            alert("Contraseña incorrecta.");
        }
    }

    function changeSection(targetId) {
        document.querySelectorAll('section').forEach(s => {
            s.className = 'seccion-oculta';
        });
        document.getElementById(`sec-${targetId}`).className = 'seccion-activa';
        
        document.querySelectorAll('.nav-link').forEach(l => {
            l.classList.remove('active');
            if(l.dataset.target === targetId) l.classList.add('active');
        });

        if(window.innerWidth < 768) toggleMenu(false);
    }

    function toggleMenu(forceState = null) {
        if (forceState === false) {
            ui.sidebar.classList.remove("active");
            ui.overlay.classList.remove("active");
        } else {
            ui.sidebar.classList.toggle("active");
            ui.overlay.classList.toggle("active");
        }
    }

    function setupEventListeners() {
        ui.formLogin.addEventListener('submit', (e) => {
            e.preventDefault();
            const user = ui.userInput.value;
            const pass = ui.passInput.value;

            if (pass === "admin") {
                usuarioAutenticado = true;
                nombreAdmin = user || "Admin";
                ui.sidebarUsername.innerText = nombreAdmin;
                ui.inputAdminNombre.value = nombreAdmin;
                ui.avatarLetra.innerText = nombreAdmin.charAt(0).toUpperCase();

                ui.loginScreen.style.display = "none";
                ui.appContainer.style.display = "flex";
                if(window.innerWidth < 768) ui.appContainer.style.display = "block";
            } else {
                alert("Contraseña incorrecta.");
            }
        });

        ui.tablaInventario.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            
            const id = parseInt(btn.dataset.id);
            const action = btn.dataset.action;

            if (action === 'add') handleStockChange(id, 1);
            if (action === 'sell') handleVenta(id);
            if (action === 'loss') handlePerdida(id);
            if (action === 'delete') handleDelete(id);
        });

        ui.sidebarNav.addEventListener('click', (e) => {
            if(e.target.classList.contains('nav-link')) {
                e.preventDefault();
                changeSection(e.target.dataset.target);
            }
        });

        ui.btnLogout.addEventListener('click', () => {
            if(confirm("¿Cerrar sesión?")) location.reload();
        });

        ui.btnMenuMovil.addEventListener('click', () => toggleMenu());
        ui.overlay.addEventListener('click', () => toggleMenu(false));

        ui.btnAbrirModal.addEventListener('click', () => ui.modal.style.display = "block");
        ui.btnCerrarModal.addEventListener('click', () => ui.modal.style.display = "none");
        window.addEventListener('click', (e) => {
            if (e.target === ui.modal) ui.modal.style.display = "none";
        });

        ui.formProducto.addEventListener('submit', (e) => {
            e.preventDefault();
            const nombre = document.getElementById("nombre").value;
            const categoria = document.getElementById("categoria").value;
            const precio = parseFloat(document.getElementById("precio").value);
            const stock = parseInt(document.getElementById("stock").value);

            alasql("INSERT INTO inventario (nombre, categoria, precio, stock) VALUES (?,?,?,?)", [nombre, categoria, precio, stock]);
            guardarTodo();
            actualizarUI();
            ui.modal.style.display = "none";
            ui.formProducto.reset();
        });

        ui.btnEditarCaja.addEventListener('click', () => {
            const pass = prompt("ADMIN\n\nContraseña:", "admin");
            if (pass === "admin") {
                const nuevo = prompt("Nuevo saldo:", cajaChica);
                if (nuevo !== null && !isNaN(nuevo)) {
                    cajaChica = parseFloat(nuevo);
                    guardarTodo();
                    actualizarStats();
                }
            } else {
                alert("Incorrecto.");
            }
        });

        ui.btnBorrarHistorial.addEventListener('click', () => {
            const pass = prompt("BORRAR HISTORIAL\n\nContraseña:", "admin");
            if (pass === "admin") {
                alasql("DELETE FROM ventas");
                guardarTodo();
                actualizarUI();
            } else {
                alert("Incorrecto.");
            }
        });

        ui.formConfig.addEventListener('submit', (e) => {
            e.preventDefault();
            nombreAdmin = ui.inputAdminNombre.value;
            ui.sidebarUsername.innerText = nombreAdmin;
            ui.avatarLetra.innerText = nombreAdmin.charAt(0).toUpperCase();
            alert("Perfil actualizado.");
        });
    }

    init();
});