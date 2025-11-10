import express from "express";
import prisma from "../utils/prisma.js";
import tokenDecodificar from "../utils/tokenDecodificar.js";
import conversaoMoedas from "../utils/conversaoMoedas.js";
import cadastro from "./auth/cadastro.js";
import login from "./auth/login.js";
import pagamentos from "./payment.js";
import usuarios from "./usuarioPublic/usuarios.js";
import userCarrinho from "./usuarioPublic/userCarrinho.js";
import compras from "./compras.js";
const router = express.Router();
router.use("/pagamento", pagamentos);
router.use("/cadastro", cadastro);
router.use("/login", login);
router.use("/usuarios", usuarios);
router.use("/usuario-carrinho", userCarrinho);
router.use("/compras", compras);

router.get("/produtos", async (req, res) => {
  const page = parseInt(req.query.page);
  const size = parseInt(req.query.size);
  try {
    const response = await prisma.produto.findMany({
      skip: page,
      take: size,
    });
    if (response) {
      var produtos = conversaoMoedas.centavosParaReais(response);
    }
    return res
      .status(200)
      .json({ message: "Produtos listados com sucesso!", produtos: produtos });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Erro no servidor, tente novamente" });
  }
});

router.put("/produtosRemovidosBanco", async (req, res) => {
  const produtos = req.body.produtos;
  console.log(produtos);
  if (produtos.length > 0) {
    const tokenUser = await tokenDecodificar.decodedToken(
      req.headers.authorization
    );
    if (tokenUser) {
      const user = await prisma.user.findUnique({
        where: {
          id: tokenUser.id,
        },
      });
      if (user) {
        const newProdutosUser = user.carrinho.filter(
          (produto) => !produtos.includes(produto)
        );
        if (newProdutosUser) {
          const response = await prisma.user.update({
            where: { id: user.id },
            data: {
              carrinho: newProdutosUser,
            },
          });
          console.log(response);
          return res
            .status(200)
            .json({ message: "carrinho atualizado!", user: response });
        }
      } else {
        return res.status(404).json({ message: "Usuário não encontrado!" });
      }
    } else {
      return res.status(404).json({ message: "Não está logado" });
    }
  } else {
    return res
      .status(404)
      .json({ message: "Nenhum produto foi removido do banco!" });
  }
});

export default router;
