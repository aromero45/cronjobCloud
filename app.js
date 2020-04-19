const express = require('express');
const morgan = require('morgan');
const exphbs = require('express-handlebars');
const path = require('path');
const flash = require('connect-flash');
const session = require('express-session');
const MySQLStore = require('express-mysql-session');
const passport = require('passport');
const bodyParser = require('body-parser');
const validator = require('express-validator');
const fileUpload = require('express-fileupload');
var AWS = require('aws-sdk');
const dotenv = require('dotenv');
const fs = require('fs');
const cron = require("node-cron");
const exec = require('child_process').exec;


/*
if(process.env.NODE_ENV === 'aws'){
  dotenv.config( {path: "./environments/aws.env"});
}else{
  dotenv.config( {path: "./environments/local.env"});
}*/


dotenv.config( {path: "./environments/aws.env"});

const database={
  host:process.env.HOST,
  port:process.env.PORT_DB,
  user:process.env.USER_DB,
  password:process.env.PASSWORD_DB,
  database:process.env.DATABASE
};

AWS.config.update({
    region: 'us-east-1',
    accessKeyId:process.env.ACCES_KEY_ID,
    secretAccessKey:process.env.SECRET_ACCESS_KEY
});

const RUTA_GESTOR_ARCHIVOS = process.env.ruta_gestion_archivos;
const ses = new AWS.SES({ apiVersion: "2010-12-01" });

//inicializar
const pool = require('./database.js');
const app = express();

//settings 
app.set('port', process.env.PORT || 3000);

//Middlewares

app.use(morgan('dev'));
app.use(express.urlencoded({extended: false})); 
app.use(express.json()); 
app.use(fileUpload());

app.use(session({
   secret: 'alex',
   resave: false,
   saveUninitialized: false,
   store: new MySQLStore(database)
}));

app.use(flash());
//app.use(validator());

//Global variables
app.use ((req, res, next) =>{
  app.locals.success = req.flash('success');
  app.locals.message = req.flash('message');
  app.locals.user = req.user;  
  next();
});
/*
//routes
app.use(require('./routes/index'));
app.use(require('./routes/authentication'));
app.use('/links',require('./routes/links'));
app.use('/videos',require('./routes/videos'));
*/
//public

app.use(express.static(path.join(__dirname, 'public')));

//start de server




//cron.schedule("0,10 * * * *", function() { //se ejecuta cada 10 minutos
//para 3 minutos */3 

cron.schedule("0,10 * * * *", function() { //se ejecuta cada 10 minutos
    console.log("running a task every 10 minutes");
  
    pool.query('SELECT original_video,contest_id,email,id from videos WHERE status like ("No Convertido")', function(err,res){
        if(err){
          throw err;
        }else{
            for(ind in res){
                var contestid=res[ind].contest_id;
                var viid=res[ind].id; 
                let fileName= res[ind].original_video;
                let filePath = RUTA_GESTOR_ARCHIVOS+contestid+'/inicial/'+fileName;
                //console.log(filePath);
                //console.log(viid); 
                let filePathConverted = RUTA_GESTOR_ARCHIVOS+contestid+'/convertido/'+fileName.split('.')[0]+'.mp4';
                //console.log(filePathConverted);
                fs.readFile(filePath, function(err,data){
                    console.log("File buffer: ", data)
                    if(err){
                        throw err;
                    }else{
                        //console.log('ffmpeg -i ' + filePath +' '+filePathConverted);
                        exec('ffmpeg -i ' + filePath +' '+filePathConverted,function (error, stdout, stderr) {
                            console.log("Convirtiendo");
                            console.log(stdout);
                            if (error !== null) {
                             console.log('exec error: ' + error);
                            }else{
                                let fileNameConv=fileName.split('.')[0]+'.mp4';
                                let status = "Convertido"; 
                                pool.query('UPDATE videos set status = ?, converted_video = ? WHERE id = ?',[status,fileNameConv,viid], function(errores,respuesta){
                                    if(errores){
                                        throw errores;
                                    }else{
                                        //console.log(respuesta);
                                        pool.query('SELECT * from contest WHERE id = ?',[contestid], function(error, result){
                                            if(error){
                                                throw error
                                            }else{
                                                let urlvideo = result[0].url; 
                                                envioCorreo(res[ind].email, urlvideo);
                                            }
                                        }); 
                                    }
                                });
                            }
                        });
                    }
                });
            }     
        }
    });
});


function envioCorreo(correo, url) {
    var params = {
        Destination: { 
        ToAddresses: [
            correo,
        ]
        },
        Source: 'alex4543@hotmail.com',
        Message: {
            Body: {
              Html: {
                Charset: "UTF-8",
                Data:
                  "<html><body><h1>Video Procesado!!</h1> <p>Tu video ha sido procesado, en el concurso: http://elbsmart-400937604.us-east-1.elb.amazonaws.com/videos/"+url+" ..Estas listo para concursar!!'</p></body></html>"
              },
              Text: {
                Charset: "UTF-8",
                Data: "Hello Charith Sample description time 1517831318946"
              }
            },
            Subject: {
              Charset: "UTF-8",
              Data: "Video procesado exitosamente"
            }
          }
    };
    const sendEmail = ses.sendEmail(params).promise();

    sendEmail
    .then(data => {
        console.log("email enviado SES", data);
    })
    .catch(error => {
        console.log(error);
    });
}

app.listen(app.get('port'), () => {
    console.log('Server en puerto', app.get('port'));
});