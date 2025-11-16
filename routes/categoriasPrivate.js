import express from "express";
import prisma from "../utils/prisma.js";
const app = express();
app.post("/", async (req, res) => {
  if (req.body.categoria == null || req.body.categoria == undefined) {
    res
      .status(400)
      .json({ message: "Categoria está vazia, preencha os dados!" });
  }
  const categoria = req.body.categoria;
  try {
    const response = await prisma.categoria.create({
      data: {
        nome: categoria,
      },
    });
    res.status(201).json({
      message: "Categoria criada com sucesso!",
      categoria: response.nome,
    });
  } catch (error) {
    res.status(500).json({
      message: "Ocorreu um erro no servidor, tente novamente!",
      erro: error,
    });
  }
});
app.put("/", async (req, res) => {
  console.log(req.body.categoria.nome);
  if (req.body.categoria.nome == undefined || req.body.categoria.nome == "") {
    res.status(401).json({ message: "Categoria vazia, digite alguma!" });
  }
  const { nome, id } = req.body.categoria;
  const response = await prisma.categoria.update({
    where: { id: id },
    data: {
      nome: nome,
    },
  });
  res.status(200).json({
    message: "Categoria editada com sucesso!",
    categoria: response.nome,
  });
});
export default app;
