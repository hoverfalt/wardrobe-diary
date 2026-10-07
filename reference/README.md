# Reference outputs from the R pipeline

Export the tables the Threddit R scripts produce (e.g. per-garment times used and cost per wear,
per-category active items, inventory value, average cost per wear, daily and monthly cost) as CSV
into this folder. Tests in `web/` compare the TypeScript metrics against them, which proves the port is correct.

CSV files here are git-ignored by default since they contain personal data; remove that line from
`.gitignore` if you want them versioned.
