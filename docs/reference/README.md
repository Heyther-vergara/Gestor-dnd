# Referencia de reglas

Esta carpeta guarda el SRD 5.2.1 oficial para consultarlo mientras se desarrolla. Los archivos no se suben a git (pesan ~11 MB).

Para recrearla:

1. Descarga el SRD 5.2.1 (en español) desde https://www.dndbeyond.com/srd y guárdalo aquí como `srd-5.2.1-es.pdf`.
2. Extrae el texto para poder buscar con `grep` (`pdftotext` viene con Git para Windows):

```bash
pdftotext -enc UTF-8 docs/reference/srd-5.2.1-es.pdf docs/reference/srd-5.2.1-es.txt
```

Licencia: CC-BY-4.0, Wizards of the Coast LLC.
