"use strict";
const express = require('express');
const app = express();
app.set('puerto', 1666);
app.get('/', (request, response) => {
    response.send('GET - servidor NodeJS');
});
//AGREGO FILE SYSTEM
const fs = require('fs');
//AGREGO JSON
app.use(express.json());
//AGREGO JWT
const jwt = require("jsonwebtoken");
//SE ESTABLECE LA CLAVE SECRETA PARA EL TOKEN
app.set("key", "cl@ve_secreta");
app.use(express.urlencoded({ extended: false }));
//AGREGO MULTER
const multer = require('multer');
//AGREGO MIME-TYPES
const mime = require('mime-types');
//AGREGO STORAGE
const storage = multer.diskStorage({
    destination: "public/fotos/",
});
const upload = multer({
    storage: storage
});
//AGREGO CORS (por default aplica a http://localhost)
const cors = require("cors");
//AGREGO MW 
app.use(cors());
//DIRECTORIO DE ARCHIVOS ESTÁTICOS
app.use(express.static("public"));
//AGREGO MYSQL y EXPRESS-MYCONNECTION
const mysql = require('mysql');
const myconn = require('express-myconnection');
const db_options = {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    database: 'productos_usuarios_node'
};
app.use(myconn(mysql, db_options, 'single'));
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//// VERIFICAR JWT //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const verificar_jwt = express.Router();
verificar_jwt.use((request, response, next) => {
    //SE RECUPERA EL TOKEN DEL ENCABEZADO DE LA PETICIÓN
    let token = request.headers["x-access-token"] || request.headers["authorization"];
    if (!token) {
        response.status(401).send({
            error: "El JWT es requerido!!!"
        });
        return;
    }
    if (token.startsWith("Bearer ")) {
        token = token.slice(7, token.length);
    }
    if (token) {
        //SE VERIFICA EL TOKEN CON LA CLAVE SECRETA
        jwt.verify(token, app.get("key"), (error, decoded) => {
            if (error) {
                return response.json({
                    exito: false,
                    mensaje: "El JWT NO es válido!!!",
                    status: 403
                });
            }
            else {
                console.log("middleware verificar_jwt");
                //SE AGREGA EL TOKEN AL OBJETO DE LA RESPUESTA
                response.jwt = decoded;
                //SE INVOCA AL PRÓXIMO CALLEABLE
                next();
            }
        });
    }
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//// SOLO ADMIN ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const solo_admin = express.Router();
solo_admin.use(verificar_jwt, (request, response, next) => {
    console.log("middleware solo_admin");
    //SE RECUPERA EL TOKEN DEL OBJETO DE LA RESPUESTA
    let usuario = response.jwt;
    if (usuario.perfil == "administrador") {
        //SE INVOCA AL PRÓXIMO CALLEABLE
        next();
    }
    else {
        return response.json({
            mensaje: "NO tiene perfil de 'ADMINISTRADOR'"
        });
    }
} /*, function (request:any, response:any, next:any) {
    console.log('Request Type:', request.method);
    next();
  }*/);
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// RUTA VERIFICAR ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/verificar_token', verificar_jwt, (request, response) => {
    response.json({ exito: true, jwt: response.jwt });
});
app.get('/admin', solo_admin, (request, response) => {
    response.json(response.jwt);
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////// VERIFICAR USUARIO /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const verificar_usuario = express.Router();
verificar_usuario.use((request, response, next) => {
    let obj = request.body;
    request.getConnection((err, conn) => {
        if (err)
            throw ("Error al conectarse a la base de datos.");
        conn.query("select * from usuarios where legajo = ? and apodo = ? ", [obj.legajo, obj.apodo], (err, rows) => {
            if (err)
                throw ("Error en consulta de base de datos.");
            if (rows.length == 1) {
                response.obj_usuario = rows[0];
                //SE INVOCA AL PRÓXIMO CALLEABLE
                next();
            }
            else {
                response.status(401).json({
                    exito: false,
                    mensaje: "apodo y/o Legajo incorrectos.",
                    jwt: null,
                });
            }
        });
    });
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////// VERIFICAR TOKEN /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/verificar_token', verificar_jwt, (request, response) => {
    response.status(200).json({ exito: true, jwt: response.jwt });
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// LOGIN //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.post("/login", verificar_usuario, (request, response, obj) => {
    //SE RECUPERA EL USUARIO DEL OBJETO DE LA RESPUESTA
    const user = response.obj_usuario;
    //SE CREA EL PAYLOAD CON LOS ATRIBUTOS QUE NECESITAMOS
    const payload = {
        usuario: {
            id: user.id,
            apellido: user.apellido,
            nombre: user.nombre,
            rol: user.rol,
            apodo: user.apodo
        },
        api: "productos_usuarios_node",
    };
    //SE FIRMA EL TOKEN CON EL PAYLOAD Y LA CLAVE SECRETA
    const token = jwt.sign(payload, app.get("key"), {
        expiresIn: "5m"
    });
    response.status(200).json({
        exito: true,
        mensaje: "JWT creado!!!",
        jwt: token,
    });
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////// CRUD PRODUCTOS //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//LISTAR
app.get('/productos_bd', verificar_jwt, (request, response) => {
    request.getConnection((err, conn) => {
        if (err)
            throw ("Error al conectarse a la base de datos.");
        conn.query("select * from productos", (err, rows) => {
            if (err)
                throw ("Error en consulta de base de datos.");
            response.status(200).json({
                exito: true,
                dato: JSON.stringify(rows)
            });
        });
    });
});
//AGREGAR
app.post('/productos_bd', verificar_jwt, upload.single("foto"), (request, response) => {
    let file = request.file;
    let extension = mime.extension(file.mimetype);
    let obj = JSON.parse(request.body.obj);
    let path = file.destination + obj.codigo + "." + extension;
    fs.renameSync(file.path, path);
    obj.path = path.split("public/")[1];
    request.getConnection((err, conn) => {
        if (err)
            throw ("Error al conectarse a la base de datos.");
        conn.query("insert into productos set ?", [obj], (err, rows) => {
            if (err) {
                console.log(err);
                throw ("Error en consulta de base de datos.");
            }
            response.status(200).json({
                exito: true,
                mensaje: "Producto agregado!"
            });
            ;
        });
    });
});
//MODIFICAR
app.post('/productos_bd/modificar', verificar_jwt, upload.single("foto"), (request, response) => {
    let file = request.file;
    let extension = mime.extension(file.mimetype);
    let obj = JSON.parse(request.body.obj);
    let path = file.destination + obj.codigo + "." + extension;
    fs.renameSync(file.path, path);
    obj.path = path.split("public/")[1];
    let obj_modif = {};
    //para excluir la pk (codigo)
    obj_modif.marca = obj.marca;
    obj_modif.precio = obj.precio;
    obj_modif.path = obj.path;
    obj_modif.tipo = obj.tipo;
    request.getConnection((err, conn) => {
        if (err)
            throw ("Error al conectarse a la base de datos.");
        conn.query("update productos set ? where codigo = ?", [obj_modif, obj.codigo], (err, rows) => {
            if (err) {
                console.log(err);
                throw ("Error en consulta de base de datos.");
            }
            response.status(200).json({
                exito: true,
                mensaje: "Producto modificado"
            });
        });
    });
});
//ELIMINAR
app.post('/productos_bd/eliminar', verificar_jwt, (request, response) => {
    let obj = request.body;
    let path_foto = "public/";
    request.getConnection((err, conn) => {
        if (err)
            throw ("Error al conectarse a la base de datos.");
        //obtengo el path de la foto del producto a ser eliminado
        conn.query("select path from productos where codigo = ?", [obj.codigo], (err, result) => {
            if (err)
                throw ("Error en consulta de base de datos.");
            //console.log(result[0].path);
            path_foto += result[0].path;
        });
    });
    request.getConnection((err, conn) => {
        if (err)
            throw ("Error al conectarse a la base de datos.");
        conn.query("delete from productos where codigo = ?", [obj.codigo], (err, rows) => {
            if (err) {
                console.log(err);
                throw ("Error en consulta de base de datos.");
            }
            fs.unlink(path_foto, (err) => {
                if (err)
                    throw err;
                console.log(path_foto + ' fue borrado.');
            });
            response.status(200).json({
                exito: true,
                mensaje: "objeto codigo " + obj.codigo + " fue eliminado"
            });
        });
    });
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// IMPORTANTE ///
app.listen(app.get('puerto'), () => {
    console.log('Servidor corriendo sobre puerto:', app.get('puerto'));
});
//# sourceMappingURL=server_node.js.map