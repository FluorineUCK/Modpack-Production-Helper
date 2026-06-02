# Recipe Schema

Required frontmatter fields:

| Field | Meaning |
|---|---|
| type | Always `recipe` |
| schema | Schema version number |
| id | Original or inferred recipe ID |
| method | Process method, such as `smelting` |
| machine | Wiki-link to the machine note |
| mod | Wiki-link to the mod note |
| stage | Production stage |
| status | Import confidence and edit status |
| input_links | Static wiki-links to item or fluid inputs |
| output_links | Static wiki-links to item or fluid outputs |
| machine_links | Static wiki-links to machines |
| inputs | Structured input records |
| outputs | Structured output records |
| time | Processing time if known |
| energy | Energy cost if known |
| tags | Classification tags |

Tag ingredients are stored in `inputs` with IDs like `#forge:ingots/iron` and do not create item notes by default.
