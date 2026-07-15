const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'pasarin-comprobantes',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
    resource_type: 'auto'
  }
});

const MAX_COMPROBANTE_MB = 5;
const upload = multer({ storage, limits: { fileSize: MAX_COMPROBANTE_MB * 1024 * 1024 } });

const storageFoto = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'pasarin-alumnos',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    resource_type: 'image',
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }]
  }
});

const MAX_FOTO_MB = 2;
const uploadFoto = multer({ storage: storageFoto, limits: { fileSize: MAX_FOTO_MB * 1024 * 1024 } });

module.exports = { upload, uploadFoto, MAX_COMPROBANTE_MB, MAX_FOTO_MB };
