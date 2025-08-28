export default {
  centavosParaReais(array) {
    return array.map((produto) => {
      // Divide por 100 e formata para 2 casas decimais
      const valor = (produto.precoCentavos / 100).toFixed(2);

      // Substitui ponto por vírgula
      produto.precoCentavos = valor.replace(".", ",");

      return produto;
    });
  },

  reaisParaCentavos(array) {
    const produtos = [];
    array.map((produto) => {
      produto.precoCentavos = produto.precoCentavos * 100;
      produtos.push(produto);
    });
    return produtos;
  },
};
