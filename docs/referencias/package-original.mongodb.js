use biblioteca;

db.midias.insertMany([
  {
    codigo_chamada: "LIV-001",
    tipo: "livro",
    titulo: "Inteligência Artificial",
    autores: ["Stuart Russell", "Peter Norvig"],
    assuntos: ["Computação", "IA", "Algoritmos"],
    publicacao: {
      data: ISODate("2013-10-15T00:00:00Z"),
      cidade: "Rio de Janeiro",
      editora: "Campus",
      ano: 2013
    }
  },
  {
    codigo_chamada: "LIV-002",
    tipo: "livro",
    titulo: "Sistemas Operacionais Modernos",
    autores: ["Andrew S. Tanenbaum"],
    assuntos: ["Sistemas", "Computação"],
    publicacao: {
      data: ISODate("1978-05-20T00:00:00Z"),
      cidade: "São Paulo",
      editora: "Pearson",
      ano: 1978
    }
  },

  {
    codigo_chamada: "MON-001",
    tipo: "monografia",
    titulo: "Aplicações de Aprendizado de Máquina na Saúde",
    autores: ["Maria Silva"],
    assuntos: ["Medicina", "Computação"],
    publicacao: {
      data: ISODate("2021-11-30T00:00:00Z"),
      universidade: "Unochapecó",
      ano: 2021
    }
  },

  {
    codigo_chamada: "PER-001",
    tipo: "periodico",
    titulo: "Revista Brasileira de Informática",
    assuntos: ["Tecnologia", "Computação", "Inovação"],
    publicacao: {
      data: ISODate("2020-01-10T00:00:00Z"),
      cidade: "Porto Alegre",
      editora: "SBC",
      ano: 2020,
      periodicidade: "Mensal",
      url: "https://sbc.org.br/rbi"
    }
  },
  {
    codigo_chamada: "PER-002",
    tipo: "periodico",
    titulo: "Journal of Systems Research",
    assuntos: ["Engenharia", "Sistemas"],
    publicacao: {
      data: ISODate("2019-06-15T00:00:00Z"),
      cidade: "Porto Alegre",
      editora: "TechPress",
      ano: 2019,
      periodicidade: "Trimestral",
      url: "https://journalsystems.org"
    }
  }
]);

//Consultas

db.midias.find(
  { tipo: "livro" },
  { _id: 0, titulo: 1, autores: 1 }
);

db.midias.find(
  { tipo: "livro", titulo: "Inteligência Artificial" },
  { _id: 0, titulo: 1, autores: 1, "publicacao.ano": 1 }
);

db.midias.find(
  { tipo: "periodico", "assuntos.1": "Computação" },
  { _id: 0, titulo: 1, assuntos: 1, "publicacao.url": 1 }
);

db.midias.find(
  { tipo: "livro", "publicacao.ano": { $gt: 2010 } },
  { _id: 0, titulo: 1, autores: 1, "publicacao.ano": 1 }
);

db.midias.find(
  { tipo: "periodico" }
);

db.midias.find(
  { tipo: "livro" },
  { publicacao: 0 }
);

db.midias.aggregate([
  {
    $group: {
      _id: "$tipo",
      total: { $sum: 1 }
    }
  }
]);

db.midias.updateMany(
  { tipo: "periodico", "publicacao.cidade": "Porto Alegre" },
  { $set: { "publicacao.ano": 2022 } }
);

db.midias.updateMany(
  { tipo: "periodico" },
  { $set: { "publicacao.data_acesso": new Date() } }
);

db.midias.deleteMany(
  { tipo: "livro", "publicacao.ano": { $lt: 1980 } }
);

db.midias.deleteMany(
  { tipo: "livro", autores: "Stuart Russell" }
);
