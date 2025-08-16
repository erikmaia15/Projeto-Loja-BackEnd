import { v2 as cloudinary } from "cloudinary";
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NOME,
  api_key: process.env.CLOUDINARY_CHAVE_API,
  api_secret: process.env.CLOUDINARY_SECRET_CHAVE,
  secure: true,
});

export default cloudinary;
