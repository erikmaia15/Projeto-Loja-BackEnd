import express from "express";
import prisma from "../utils/prisma.js";
import produto from "./produtosPrivate.js";
import tokenDecodificar from "../utils/tokenDecodificar.js";
const app = express();
app.use("/produtos", produto);

app.get("/listar-usuarios", async (req, res) => {
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
app.put("/atualizar-usuario", async (req, res) => {
  try {
    const inforUser = req.body;
    const response = await prisma.user.update({
      where: { id: inforUser.id },
      data: {
        email: inforUser.email,
      },
    });
    return res
      .status(201)
      .json({ message: "usuário atualizado", usuario: response });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "erro ao atualizar usuários" });
  }
});
app.put("/atualizar-usuario-admin", async (req, res) => {
  const token = req.headers.authorization;
  const isAdmin = await tokenDecodificar.decodedToken(token);
  console.log(isAdmin);
  const id = req.body.id;
  if (isAdmin.isAdmin === true) {
    try {
      const response = await prisma.user.update({
        where: { id: id },
        data: {
          isAdmin: true,
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

export default app;
