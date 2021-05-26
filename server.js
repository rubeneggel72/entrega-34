import express from 'express'
import http from 'http'
import cookieParser from 'cookie-parser'
import session from 'express-session'
import MongoStore from 'connect-mongo'

/* -------------- PASSPORT ----------------- */
import passport from 'passport';
import bCrypt from 'bcrypt';
import { Strategy as LocalStrategy } from 'passport-local'
import { user as User } from './db/model.js';
import { fork } from 'child_process'
passport.use('login', new LocalStrategy({
    passReqToCallback : true
  },
  function(req, username, password, done) { 
    // check in mongo if a user with username exists or not
    User.findOne({ 'username' :  username }, 
      function(err, user) {
        // In case of any error, return using the done method
        if (err)
          return done(err);
        // Username does not exist, log error & redirect back
        if (!user){
          console.log('User Not Found with username '+username);
          console.log('message', 'User Not found.');                 
          return done(null, false)
        }
        // User exists but wrong password, log the error 
        if (!isValidPassword(user, password)){
          console.log('Invalid Password');
          console.log('message', 'Invalid Password');
          return done(null, false) 
        }
        // User and password both match, return user from 
        // done method which will be treated like success
        return done(null, user);
      }
    );
  })
);

var isValidPassword = function(user, password){
  return bCrypt.compareSync(password, user.password);
}

passport.use('register', new LocalStrategy({
    passReqToCallback : true
  },
  function(req, username, password, done) {
    const findOrCreateUser = function(){
      // find a user in Mongo with provided username
      User.findOne({'username':username},function(err, user) {
        // In case of any error return
        if (err){
          console.log('Error in SignUp: '+err);
          return done(err);
        }
        // already exists
        if (user) {
          console.log('User already exists');
          console.log('message','User Already Exists');
          return done(null, false)
        } else {
          // if there is no user with that email
          // create the user
          var newUser = new User();
          // set the user's local credentials
          newUser.username = username;
          newUser.password = createHash(password);

          // save the user
          newUser.save(function(err) {
            if (err){
              console.log('Error in Saving user: '+err);  
              throw err;  
            }
            console.log('User Registration succesful');    
            return done(null, newUser);
          });
        }
      });
    }
    // Delay the execution of findOrCreateUser and execute 
    // the method in the next tick of the event loop
    process.nextTick(findOrCreateUser);
  })
)
  // Generates hash using bCrypt
var createHash = function(password){
  return bCrypt.hashSync(password, bCrypt.genSaltSync(10), null);
}
   
// Configure Passport authenticated session persistence.
//
// In order to restore authentication state across HTTP requests, Passport needs
// to serialize users into and deserialize users out of the session.  The
// typical implementation of this is as simple as supplying the user ID when
// serializing, and querying the user record by ID from the database when
// deserializing.
passport.serializeUser(function(user, done) {
  done(null, user._id);
});
 
passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});
/* ----------------------------------------- */
const app = express()
app.get('/info', (req,res) => {
  let argv=[]
  process.argv.forEach((val,index)=>{
      let newObj = {};
      newObj[index]=val
      argv.push(newObj)
  })
  
  let info=[{'port':process.env.PORT },
  {'argumento de entrada':argv},
  {'sistema operativo': process.platform},
  {'version de node': process.version},
  {'memoria utilizado MB': process.memoryUsage()},
  {'path de ejecucion': process.execPath},
  {'process id: ': process.pid},
  {'carpeta corriente':  process.cwd()}
]

  // console.log('argumento de entrada'+argv)
  // console.log('sistema operativo'+ process.platform)
  // console.log('version de node'+ process.version)
  // console.log('path de ejecucion'+ process.execPath)
  // con
  
 res.end(`${JSON.stringify(info)}`)
})


app.get('/randoms/:cant', (req,res) => {
  const computo = fork('./child/computo.js')
  
  let { cant } = req.params  
  computo.send(cant)
  computo.on('message', sum => {
      res.end(`${sum}`)
  })
})


app.use(cookieParser())
app.use(session({
    store: MongoStore.create({ 
        //En Atlas connect App: Make sure to change the node version to 2.2.12:
        mongoUrl: 'mongodb+srv://Eggel:coderhouse@cluster0.iazms.mongodb.net/ecommerce?retryWrites=true&w=majority',
        //mongoOptions: { useNewUrlParser: true, useUnifiedTopology: true },
        ttl: 600
    }),
    secret: 'shhhhhhhhhhhhhhhhhhhhh',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        maxAge: 600000
    }
}))

app.use(passport.initialize());
app.use(passport.session());

const getNombreSession = req => req.session.nombre? req.session.nombre: ''

const server = http.Server(app)

import { Server as Socket } from 'socket.io'
const io = new Socket(server)

import handlebars from 'express-handlebars'
import Productos from './api/productos.js'
import Mensajes from './api/mensajes.js'
import { MongoDB } from './db/db.js'

let productos = new Productos()
let mensajes = new Mensajes()

import { getProdRandom } from './generador/productos.js'

//--------------------------------------------
//establecemos la configuración de handlebars
app.engine(
    "hbs",
    handlebars({
      extname: ".hbs",
      defaultLayout: 'index.hbs',
    })
);
app.set("view engine", "hbs");
app.set("views", "./views");
//--------------------------------------------

app.use(express.static('public'))

/* -------------------------------------------------------- */
/* -------------- LOGIN y LOGOUT DE USUARIO --------------- */
/* -------------------------------------------------------- */
app.use(express.urlencoded({extended: true}))

/* --------- LOGIN ---------- */
app.get('/login', (req,res) => {
    if(req.isAuthenticated()){
        res.render("home", {
            nombre: req.user.username
        })
    }
    else {
        res.sendFile(process.cwd() + '/public/login.html')
    }
})

app.post('/login', passport.authenticate('login', { failureRedirect: '/faillogin' }), (req,res) => {
    res.redirect('/')        
})

app.get('/faillogin', (req,res) => {
    res.render('login-error', {});
})

/* --------- REGISTER ---------- */
app.get('/register', (req,res) => {
    res.sendFile(process.cwd() + '/public/register.html')
})

app.post('/register', passport.authenticate('register', { failureRedirect: '/failregister' }), (req,res) => {
    res.redirect('/') 
})

app.get('/failregister', (req,res) => {
    res.render('register-error', {});
})

app.get('/logout', (req,res) => {
    let nombre = req.user.username
    req.logout()
    res.render("logout", { nombre })
})
/* -------------------------------------------------------- */
/* -------------------------------------------------------- */
/* -------------------------------------------------------- */

const router = express.Router()
app.use('/api', router)

router.use(express.json())
router.use(express.urlencoded({extended: true}))


router.get('/productos/listar', async (req,res) => {
    res.json(await productos.listarAll())
})

router.get('/productos/listar/:id', async (req,res) => {
    let { id } = req.params
    res.json(await productos.listar(id))
})

router.post('/productos/guardar', async (req,res) => {
    let producto = req.body
    await productos.guardar(producto)
    res.json(producto)
    //res.redirect('/')
})

router.put('/productos/actualizar/:id', async (req,res) => {
    let { id } = req.params
    let producto = req.body
    await productos.actualizar(producto,id)
    res.json(producto)
})

router.delete('/productos/borrar/:id', async (req,res) => {
    let { id } = req.params
    let producto = await productos.borrar(id)
    res.json(producto)
})

router.get('/productos/vista', async (req, res) => {
    let prods = await productos.listarAll()

    res.render("vista", {
        productos: prods,
        hayProductos: prods.length
    })
})

router.get('/productos/vista-test', async (req, res) => {

    let cant = req.query.cant || 10
    let prods = []
    for(let i=0; i<cant; i++) prods.push(getProdRandom(i+1))

    //console.log(prods)
    res.render("vista", {
        productos: prods,
        hayProductos: prods.length
    })
})

/* -------------------- Web Sockets ---------------------- */
io.on('connection', async socket => {
    console.log('Nuevo cliente conectado!');
    
    /* ------------------- */
    /* Info Productos (ws) */
    /* ------------------- */
    /* Envio los mensajes al cliente que se conectó */
    socket.emit('productos', await productos.get());

    /* Escucho los mensajes enviado por el cliente y se los propago a todos */
    socket.on('update', async data => {
        if(data = 'ok') {
            io.sockets.emit('productos',  await productos.get()); 
        }
    })

    /* ----------------------- */
    /* Centro de mensajes (ws) */
    /* ----------------------- */
    socket.emit('messages', await mensajes.getAll());

    socket.on('new-message', async function(data) {
        //console.log(data)
        await mensajes.guardar(data); 
        io.sockets.emit('messages', await mensajes.getAll()); 
    })    
});
/* ------------------------------------------------------- */
const PORT = process.env.PORT || 8080;
const srv = server.listen(PORT, async () => {
    console.log(`Servidor http escuchando en el puerto ${srv.address().port}`)
    try {
        const mongo = new MongoDB('mongodb+srv://Eggel:coderhouse@cluster0.iazms.mongodb.net/ecommerce?retryWrites=true&w=majority')
        await mongo.conectar()
        console.log('base MongoDB conectada')
    }
    catch(error) {
        console.log(`Error en conexión de Base de datos: ${error}`)
    }
})
srv.on("error", error => console.log(`Error en servidor ${error}`))
