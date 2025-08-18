import express from "express";
import prisma from "../utils/prisma.js";
import upload from "../src/config/upload.js";
import cloudinary from "../src/config/cloudinary.js";
import fs from "fs";
import tokenDecodificar from "../utils/tokenDecodificar.js";
const router = express.Router();

router.get("/listar-usuarios", async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.status(200).json({
      message: "Lista de usuários",
      users: users,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "erro no servidor, tente novamente" });
  }
});
router.put("/atualizar-usuarios", async (req, res) => {
  const usersUpdate = req.body.users;
  try {
    const response = await prisma.user.updateMany({
      data: {},
    });
    console.log(response);
    return res.status(201).json({ message: "usuários atualizados" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "erro ao atualizar usuários" });
  }
});
router.put("/atualizar-usuario-admin", async (req, res) => {
  const token = req.headers.authorization;
  const isAdmin = await tokenDecodificar.decodedToken(token);
  console.log(isAdmin);
  const id = req.body.id;
  if (isAdmin.isAdmin === true) {
    try {
      const response = await prisma.user.update({
        where: { id: id },
        data: {
          isAdmin: isAdmin.isAdmin,
        },
      });
      return res
        .status(201)
        .json({ message: "usuário atualizado", usuario: response });
    } catch (error) {
      console.log(error);
      res.status(500).json({
        message: "erro no servidor, tente novamente",
      });
    }
  } else {
    res.status(404).json({ message: "Usuário não é administrador!" });
  }
});
router.post("/produtos", upload.single("imagem"), async (req, res) => {
  console.log("Arquivo recebido:", req.file); // Verifique se o arquivo chega
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "Nenhum arquivo recebido",
        headers: req.headers, // Mostra os headers recebidos
        body: req.body,
      });
    }

    // 1. Upload para o Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "produtos",
    });

    // 2. Salva no banco de dados
    const produto = await prisma.produto.create({
      data: {
        tituloProduto: req.body.tituloProduto,
        descricao: req.body.descricao,
        preco: parseFloat(req.body.preco),
        QtdEstoque: parseInt(req.body.QtdEstoque),
        imagem: result.secure_url, // URL da imagem no Cloudinary
      },
    });

    // 3. Remove o arquivo temporário
    fs.unlinkSync(req.file.path);

    res.status(201).json(produto);
  } catch (error) {
    console.error("Erro no upload:", error);
    res.status(500).json({ error: "Erro ao processar a imagem." });
  }
});

export default router;
