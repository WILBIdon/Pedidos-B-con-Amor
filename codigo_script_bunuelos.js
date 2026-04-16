// COMPLETO: BACKEND PARA "BUÑUELOS CON AMOR"

function setup() {
  const ss = SpreadsheetApp.getActive();
  
  if(!ss.getSheetByName("Meseros")) {
    let s = ss.insertSheet("Meseros");
    s.appendRow(["Nombre", "Contraseña", "Rol"]);
    s.appendRow(["admin", "1234", "admin"]);
    s.appendRow(["Juan", "0000", "mesero"]);
  }
  if(!ss.getSheetByName("Productos")) {
    let s = ss.insertSheet("Productos");
    s.appendRow(["ID", "Nombre", "Precio", "Categoria", "Imagen"]);
    s.appendRow(["P1", "Buñuelo Tradicional", 3500, "Comida", ""]);
    s.appendRow(["P2", "Avena Helada", 4000, "Bebidas", ""]);
  }
  if(!ss.getSheetByName("Mesas")) {
    let s = ss.insertSheet("Mesas");
    s.appendRow(["Nombre_Mesa"]);
    s.appendRow(["Mesa 1"]);
    s.appendRow(["Mesa 2"]);
    s.appendRow(["Mesa 3"]);
  }
  if(!ss.getSheetByName("Comandas")) {
    let s = ss.insertSheet("Comandas");
    s.appendRow(["Fecha y Hora", "Comanda", "Estado"]);
  }
}

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Extraer Mesas
  const sMesas = ss.getSheetByName("Mesas");
  let mesas = [];
  if(sMesas) {
    const dataMesas = sMesas.getDataRange().getValues();
    for(let i=1; i<dataMesas.length; i++){
      mesas.push({nombre_mesa: dataMesas[i][0]});
    }
  }

  // Extraer Productos
  const sProd = ss.getSheetByName("Productos");
  let productos = [];
  if(sProd) {
    const dataProd = sProd.getDataRange().getValues();
    for(let i=1; i<dataProd.length; i++){
      productos.push({
        id: dataProd[i][0],
        nombre: dataProd[i][1],
        precio: dataProd[i][2],
        categoria: dataProd[i][3] || "",
        imagen: dataProd[i][4] || ""
      });
    }
  }

  const result = { success: true, mesas: mesas, productos: productos };
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let data = {};
  
  try {
    data = JSON.parse(e.postData.contents);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({success:false, error: "Error de formato"})).setMimeType(ContentService.MimeType.JSON);
  }

  const accion = data.accion;

  // 1. LOGIN DE USUARIOS
  if (accion === 'login') {
    const sMeseros = ss.getSheetByName("Meseros");
    if(!sMeseros) return end({success: false, message: "Falta tabla Meseros"});
    
    const usuarios = sMeseros.getDataRange().getValues();
    for(let i=1; i<usuarios.length; i++) {
       if(usuarios[i][0].toString().trim().toLowerCase() === data.nombre.toLowerCase() && 
          usuarios[i][1].toString() === data.pass) {
           return end({success: true, rol: usuarios[i][2] || "mesero", nombre: usuarios[i][0]});
       }
    }
    return end({success: false, message: "Credenciales inválidas"});
  }

  // 2. ENVIAR PEDIDO A COCINA
  if (accion === 'pedido') {
    let sPedidos = ss.getSheetByName("Comandas");
    if(!sPedidos) sPedidos = ss.insertSheet("Comandas");
    
    // Convertir el JSON del carrito en un texto bonito para Google Sheets
    let txtCarrito = "";
    if (data.carrito && data.carrito.length > 0) {
      txtCarrito = data.carrito.map(i => i.cantidad + "x " + i.nombre + " ($" + parseInt(i.precio).toLocaleString('es-CO') + ")").join("\n");
    }
    
    let comandaTodoStr = "MESA: " + data.mesa + "\n" +
                         "MESERO: " + data.mesero + "\n" +
                         "---------------------\n" +
                         txtCarrito + "\n" +
                         "---------------------\n" +
                         "TOTAL: $" + data.total.toLocaleString('es-CO');
    
    sPedidos.appendRow([new Date(), comandaTodoStr, "En Preparación"]);
    return end({success: true});
  }

  // 3. RECUPERACION DE CONTRASEÑA ADMIN (SOLICITAR PIN)
  if (accion === 'solicitar_pin') {
    let sAdmin = ss.getSheetByName("AdminConf");
    if(!sAdmin) sAdmin = ss.insertSheet("AdminConf");
    
    const pinStr = Math.floor(1000 + Math.random() * 9000).toString();
    sAdmin.getRange("A1").setValue(pinStr); // guardar pin temporalmente en A1
    
    // Intenta enviarlo al mail del admin principal
    try {
      const email = Session.getActiveUser().getEmail();
      MailApp.sendEmail(email, "🔑 PIN Administrador - Buñuelos con Amor", "Tu código para cambiar clave es: " + pinStr);
    } catch(err) {} 
    
    return end({success: true});
  }

  // 4. CAMBIAR CONTRASEÑA ADMIN (VALIDANDO PIN)
  if (accion === 'cambiar_pass_admin') {
    let sAdmin = ss.getSheetByName("AdminConf");
    if(!sAdmin) return end({success: false, message: "Pide el PIN primero"});
    
    const savedPin = sAdmin.getRange("A1").getValue().toString();
    if(savedPin === data.pin.toString()) {
       const sMeseros = ss.getSheetByName("Meseros");
       const rows = sMeseros.getDataRange().getValues();
       
       for(let i=1; i<rows.length; i++){
          if(rows[i][2] === "admin") {
             sMeseros.getRange(i+1, 2).setValue(data.nuevo_pass); 
             sAdmin.getRange("A1").clearContent(); // Borramos el pin usado para mas seguridad
             return end({success: true});
          }
       }
    }
    return end({success: false, message: "PIN inválido o expirado."});
  }

  // 5. GUARDAR NUEVO MESERO
  if (accion === 'guardar_mesero') {
    let sMeseros = ss.getSheetByName("Meseros") || ss.insertSheet("Meseros");
    sMeseros.appendRow([data.nombre_mesero, data.nuevo_pass, "mesero"]);
    return end({success: true});
  }

  // 6. AGREGAR PRODUCTO AL MENÚ
  if (accion === 'guardar_producto') {
    let sProd = ss.getSheetByName("Productos") || ss.insertSheet("Productos");
    const newId = "P" + new Date().getTime().toString().slice(-4);
    sProd.appendRow([newId, data.prod_nombre, data.prod_precio, data.prod_cat, data.prod_img || ""]);
    return end({success: true});
  }

  return end({success: false, error: "Accion invalida"});
}

function end(jsonResponse) {
  return ContentService.createTextOutput(JSON.stringify(jsonResponse)).setMimeType(ContentService.MimeType.JSON);
}
