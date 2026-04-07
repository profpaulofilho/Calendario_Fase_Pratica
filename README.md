# Calculadora de Fase Pratica

Aplicacao estatica pronta para GitHub Pages.

## Estrutura
- `index.html` - interface principal
- `styles.css` - estilos
- `app.js` - logica de calculo e exportacao PDF
- `data/sample-calendar.json` - exemplo de importacao de cotas mensais

## Como publicar no GitHub Pages
1. Crie um repositorio no GitHub.
2. Envie todos os arquivos desta pasta.
3. Em **Settings > Pages**, selecione a branch principal e a pasta raiz.
4. Aguarde a publicacao.

## Funcionalidades atuais
- modo automatico por dias uteis
- modo manual por cotas mensais
- cadastro de bloqueios e excecoes
- campo para nome do aprendiz
- relatorio mensal de dias e horas
- exportacao e importacao em JSON
- exportacao do calendario completo em PDF

## Observacao sobre PDF
A exportacao em PDF usa bibliotecas via CDN (`html2canvas` e `jsPDF`). Em GitHub Pages funciona normalmente conectado a internet.

## Proximas melhorias sugeridas
- persistencia local no navegador
- cadastro de feriados nacionais e municipais
- tela administrativa para modelos por cliente
- impressao em layout institucional SENAI
