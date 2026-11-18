# Menu em PDF

`assets/menu-shanti.pdf` é **gerado**, não editado à mão.

## Atualizar preços (rotina normal)

1. Abre `price.ods` na raiz do projeto e altera os preços.
2. Corre:

   ```bash
   ./menu/build.sh
   ```

3. O script faz tudo:
   - importa os preços do `.ods` para `js/data.js`;
   - atualiza os valores do destaque do açaí em `index.html`;
   - reconstrói `assets/menu-shanti.pdf`.
4. Recarrega o site. Para publicar, envia o `assets/menu-shanti.pdf` atualizado com o resto do site.

## Adicionar um item novo

1. Escreve o nome e o preço no `price.ods`, na coluna da categoria certa.
2. Acrescenta o item em `js/data.js` (nome PT/EN, descrição e etiqueta opcionais). O preço pode ficar igual ao do preçário.
3. Corre `./menu/build.sh`.

Se o preçário tiver um item que ainda não existe em `js/data.js`, o build **para com um aviso** e lista os nomes
em falta — assim o menu impresso nunca sai incompleto.

## Só o PDF (sem importar preços)

```bash
node menu/build-menu.mjs
```

## Requisitos

`python3`, `node` e Chromium (`/usr/bin/chromium`, ou define `CHROMIUM=/caminho/do/chromium`).

## Estrutura do PDF

- 100 × 220 mm, 6 páginas: Açaí · Menus · Sandes & Salgados · Doces & Sobremesas · Cafetaria · Bebidas.
- A ordem das páginas e o agrupamento das categorias estão em `build-menu.mjs`.
- O design e a tipografia estão em `print.css`; as fontes e o logótipo vêm de `../assets/`.
- O logótipo usado no PDF é `assets/img/logo-mark.png` (fundo transparente).

## Ficheiros

| Ficheiro | Função |
| --- | --- |
| `build.sh` | Importa preços + reconstrói o PDF |
| `import-prices.py` | Lê `price.ods` e atualiza `js/data.js` e o destaque do açaí |
| `build-menu.mjs` | Gera o HTML e imprime o PDF com o Chromium |
| `print.css` | Estilos de impressão (página, listas, capa do açaí, rodapé) |
