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

const RUTA_GESTOR_ARCHIVOS = process.env.ruta_gestion_archivos;
const ses = new AWS.SES({ apiVersion: "2010-12-01" });

//inicializar
const pool = require('./database.js');
const app = express();

//settings 
app.set('port', process.env.PORT || 4000);

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


app.listen(app.get('port'), () => {
    console.log('Server en puerto', app.get('port'));
});

//cron.schedule("0,10 * * * *", function() { //se ejecuta cada 10 minutos
cron.schedule("* * * * *", function() { //se ejecuta cada 10 minutos
    console.log("running a task every 10 minutes");
  
    pool.query('SELECT original_video,contest_id from videos WHERE status like ("No Convertido")', function(err,res){
        if(err){
          throw err;
        }else{
            for(ind in res){
                contestid=res[ind].contest_id;
                let fileName= res[ind].original_video;
                let filePath = RUTA_GESTOR_ARCHIVOS+contestid+'/inicial/'+fileName;
                console.log(filePath);
                let filePathConverted = RUTA_GESTOR_ARCHIVOS+contestid+'/convertido/'+fileName.split('.')[0]+'.mp4';
                console.log(filePathConverted);
                fs.readFile(filePath, function(err,data){
                    console.log("hola", data)
                    if(err){
                        throw err;
                    }else{
                        console.log('ffmpeg -i ' + filePath +' '+filePathConverted);
                        exec('ffmpeg -i ' + filePath +' '+filePathConverted,function (error, stdout, stderr) {
                            console.log(stdout);
                            if (error !== null) {
                             console.log('exec error: ' + error);
                            }
                        });
                    }
                });
                /*fs.readdir(RUTA_GESTOR_ARCHIVOS+contestid+'//inicial', (error, files) => { //directorio de los videos
                    
                    let totalFilesV = files.length; // return the number of files
                    console.log(totalFilesV); // print the total number of files
                    /*for(var i=0; i<totalFilesV; i++)
                    {
                        var ext = path.extname(files[i]);
                        var file = path.basename(files[i],ext);
                        console.log(files[i]); //print the file
                        console.log(file);
                        console.log(ext);
                        namefiles.push(file); //store the file name into the array files1
                        extfiles.push(ext);
                
                        var child = exec('ffmpeg -i ' + './videos/' + namefiles[i] + extfiles[i] + ' ./converts/' + namefiles[i] + '.mp4',
                        function (error, stdout, stderr) {
                            console.log(stdout);
                            if (error !== null) {
                             console.log('exec error: ' + error);
                            }
                        });
                    }
                });*/
            }     
        }
    });
});