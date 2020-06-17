const {execSync} = require('child_process');
const {S3} = require('aws-sdk');
const zlib = require('zlib');
const tar = require('tar-fs');
const fs = require('fs');
const path = require('path');
const https = require('https');

console.log('This code runs only once per Lambda cold start');

//const INPUT_PATH = '/opt/lo.tar.gz';
//const INPUT_PATH = '/opt/lo.tar.br';


function downloadImage () {
  return new Promise((resolve,reject) => {
      var req = https.get('https://s3.amazonaws.com/teachosm-geosurge-libreoffice-image-personal/lo.tar.gz');
      req.on('response', function(res) {
          console.log('res received');
          //console.log(res)
          const decompress = zlib.createGunzip();
          const output = `/tmp`;

          target = res.pipe(decompress).pipe(tar.extract(output));

          target.on('finish', () => {
            console.log('target on finish');
            fs.chmod(output, '0755', error => {
              if (error) {
                return reject(error);
              }
              console.log('target resolved');
              return resolve(output);
            });
          });
      });
    })
}

//uncomment if you wish to use a layer from https://github.com/shelfio/libreoffice-lambda-layer
// see https://github.com/alixaxel/chrome-aws-lambda
// function unpack({
//   inputPath,
//   outputBaseDir = `/tmp`,
//   outputPath = `/tmp/instdir`
// }){
//   return new Promise((resolve, reject) => {

//       console.log('before zlip Brotli Decompress');
//       const decompress = zlib.createBrotliDecompress();
//       //const decompress = zlib.createGunzip();
//       const input = fs.createReadStream(inputPath);
//       const output = `/tmp`;

//       target = input.pipe(decompress).pipe(tar.extract(output));

//       target.on('finish', () => {
//         console.log('target on finish');
//         fs.chmod(output, '0755', error => {
//           if (error) {
//             return reject(error);
//           }
//           console.log('target resolved');
//           return resolve(output);
//         });
//       });

//       console.log('done unpack');
//   });
// }

// async function start() {
//   console.log('starting unpack');
//   promise_result = await unpack({inputPath: INPUT_PATH});
//   console.log('print promise result');
//   console.log(promise_result);
// }


function readDirPromise (dirVar) {
  return new Promise((resolve,reject) => {
    fs.readdir(dirVar, (err, files) => {
                console.log('starting to read dir');
                console.log(`dirVar is ${dirVar}`);
                files.forEach(file => {
                  console.log(file);
                });
                resolve('resolved');
              });
  })
}

//you can replace with your own buckets here
const s3_input = new S3({params: {Bucket: 'teachosm-geosurge-content-uploads-personal'}});
const s3_output = new S3({params: {Bucket: 'teachosm-geosurge-content-personal'}});

//converting to pdf
const convertCommand = `/tmp/instdir/program/soffice.bin --headless --invisible --nodefault --nofirststartwizard --nolockcheck --nologo --norestore --convert-to pdf --outdir /tmp`;
//const convertCommand = `/tmp/instdir/program/soffice --headless --invisible --nodefault --nofirststartwizard --nolockcheck --nologo --norestore --convert-to pdf --outdir /tmp`;
// const convertCommand = `/opt/instdir/program/soffice --headless --invisible --nodefault --nofirststartwizard --nolockcheck --nologo --norestore --convert-to pdf --outdir /tmp`;

//converting to docx
const convertCommand_docx = `/tmp/instdir/program/soffice.bin --headless --invisible --nodefault --nofirststartwizard --nolockcheck --nologo --norestore --convert-to docx --outdir /tmp`;
// const convertCommand_docx = `/opt/instdir/program/soffice --headless --invisible --nodefault --nofirststartwizard --nolockcheck --nologo --norestore --convert-to docx --outdir /tmp`;


exports.lambdaHandler = async (event) => {

  console.log('read opt');
  await readDirPromise('/opt');

  // console.log('awating start function');
  // await start();

  console.log('begin to downloadImage');
  await downloadImage();
  

  console.log('read dirs');
  await readDirPromise('/tmp');
  console.log('done reading tmpFiles');


  console.log('read var tasks');
  await readDirPromise('/var/task');

  console.log('The value of FONTCONFIG_PATH is:', process.env.FONTCONFIG_PATH);

  console.log('trying to set FONTCONFIG_PATH');
  process.env.FONTCONFIG_PATH='/var/task'
  //process.env.FONTCONFIG_PATH='/tmp/instdir/share/fonts'

  console.log('The value of FONTCONFIG_PATH now is:', process.env.FONTCONFIG_PATH);

  console.log('print event');
  console.log(event['Records'][0]['s3']['object']['key']);
  var filename;
  filename = event['Records'][0]['s3']['object']['key'];
  
  const {Body: inputFileBuffer} = await s3_input.getObject({Key: filename}).promise();

  await fs.writeFileSync(`/tmp/${filename}`, inputFileBuffer);

  console.log('read tmp');
  await readDirPromise('/tmp');

  console.log('print ext')
  console.log(path.parse(filename).ext)

  console.log('execSync ls tmp2');
  execSync(`cd /tmp && ls`);

  if (path.parse(filename).ext != '.pdf') {
    execSync(`${convertCommand} /tmp/${filename}`);
  }
  
  const outputFilename = `${path.parse(filename).name}.pdf`;
  const outputFileBuffer = fs.readFileSync(`/tmp/${outputFilename}`);

  await s3_output
    .upload({
      Key: outputFilename, Body: outputFileBuffer,
      ACL: 'public-read', ContentType: 'application/pdf'
    })
    .promise();

  //doing for docx
  execSync(`${convertCommand_docx} /tmp/${filename}`);

  const outputFilename2 = `${path.parse(filename).name}.docx`;
  const outputFileBuffer2 = fs.readFileSync(`/tmp/${outputFilename2}`);

  await s3_output
    .upload({
      Key: outputFilename2, Body: outputFileBuffer2,
      ACL: 'public-read', ContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    })
    .promise();

  //return `https://s3.amazonaws.com/lambda-libreoffice-teachosm-demo/${outputFilename}`;
  return 'complete'
};

