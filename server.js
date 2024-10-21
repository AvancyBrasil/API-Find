import express from 'express'
import cors from 'cors'
import { PrismaClient } from '@prisma/client'
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import fetch from 'node-fetch'; // Importa o fetch para Node.js
import geolib from 'geolib';

// Definição do caminho da pasta uploads
const uploadsDir = path.resolve('uploads'); // Usa o diretório atual

// Criação da pasta uploads se não existir
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const prisma = new PrismaClient()

 const app = express()
 app.use(express.json())
 app.use(cors())

 const usuarios = []

// Configuração do Multer para upload de imagens
app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadsDir); // Pasta onde as imagens serão salvas
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + path.extname(file.originalname)); // Renomeia a imagem com timestamp
    }
  });
  
  const upload = multer({ storage });

  //Usuarios
  
  // Criação de um usuário com upload de fotoPerfil
  app.post('/usuarios', upload.single('fotoPerfil'), async (req, res) => {
    const { nome, cpf, dataNasc, telefone, cep, logradouro, bairro, cidade, email, senha } = req.body;
    const fotoPerfil = req.file ? req.file.filename : null;
  
    try {
      const usuario = await prisma.user.create({
        data: {
          nome,
          cpf,
          dataNasc,
          telefone,
          cep,
          logradouro,
          bairro,
          cidade,
          email,
          senha,
          fotoPerfil,
        }
      });
      res.status(201).json(usuario);
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      res.status(500).json({ message: 'Erro no servidor. Tente novamente mais tarde.' });
    }
  });
  
  // Atualização de um usuário com a opção de alterar a fotoPerfil
  app.put('/usuarios/:id', upload.single('fotoPerfil'), async (req, res) => {
    console.log('Corpo da requisição:', req.body); // Verifique os dados recebidos
    console.log('Arquivo recebido:', req.file); // Verifique o arquivo recebido
  
    
    const { nome, cpf, dataNasc, telefone, cep, logradouro, bairro, cidade, email, senha } = req.body;
    const fotoPerfil = req.file ? req.file.filename : undefined; // Verifique se fotoPerfil está correto
  
    console.log('Foto perfil:', fotoPerfil); // Verifique se a variável está sendo atribuída corretamente
  
    try {
      const usuarioAtualizado = await prisma.user.update({
        where: { id: req.params.id },
        data: {
          nome,
          cpf,
          dataNasc,
          telefone,
          cep,
          logradouro,
          bairro,
          cidade,
          email,
          senha,
          ...(fotoPerfil && { fotoPerfil })
        }
      });
  
      console.log('Usuário atualizado:', usuarioAtualizado); // Verifique se o usuário foi atualizado corretamente
      res.status(200).json(usuarioAtualizado);
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      res.status(500).json({ message: 'Erro no servidor. Tente novamente mais tarde.' });
    }
  });
  
  
  
  
app.get('/usuarios', async (req, res) => {
    try {
      const { id, nome, email } = req.query;
      
      let usuarios = [];
      
      if (id) {
        
        const usuario = await prisma.user.findUnique({
          where: { id: parseInt(id) }
        });
        if (usuario) {
          usuarios = [usuario];
        } else {
          return res.status(404).json({ message: 'Usuário não encontrado' });
        }
      } else {
        usuarios = await prisma.user.findMany({
          where: {
            AND: [
              nome ? { nome: { contains: nome, mode: 'insensitive' } } : {},
              email ? { email: { contains: email, mode: 'insensitive' } } : {}
            
            ]
          }
        });
      }
      
      res.status(200).json(usuarios);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  });


 app.delete('/usuarios/:id', async (req, res) => {

   await prisma.user.delete({

      where:{
         id: req.params.id
      }
   })
   res.status(200).json({message: "Usuarios deletado com sucesso!!"})
 })

 app.post('/login/usuarios', async (req, res) => {
    const { email, senha } = req.body;
    console.log('Tentativa de login com:', { email, senha });
    
    try {
        const usuario = await prisma.user.findUnique({
            where: { email: email },
        });
        
        console.log('Usuário encontrado:', usuario);

        if (usuario) {
            if (usuario.senha === senha) {
        
                
                res.status(200).json({
                    message: 'Login bem-sucedido!',
                });
            } else {
                res.status(401).json({ message: 'Email ou senha incorretos!' });
            }
        } else {
            res.status(401).json({ message: 'Email ou senha incorretos!' });
        }
    } catch (error) {
        console.error('Erro ao fazer login:', error);
        res.status(500).json({ message: 'Erro no servidor. Tente novamente mais tarde.' });
    }
});

//geolocalização 
// Função para obter latitude e longitude
const obterCoordenadas = async (logradouro, cidade, estado) => {
  const apiKey = '5977350b429f4635b2b7bb8c747346f0'; // Seu token da OpenCage
  const endereco = `${logradouro}, ${cidade}, ${estado}`;
  const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(endereco)}&key=${apiKey}`;

  try {
    const resposta = await fetch(url); // Realiza a requisição
    const dados = await resposta.json(); // Converte a resposta para JSON

    if (dados.results.length > 0) {
      const { lat, lng } = dados.results[0].geometry; // Obtém latitude e longitude
      return { latitude: lat, longitude: lng };
    } else {
      throw new Error('Não foi possível obter as coordenadas.');
    }
  } catch (error) {
    console.error('Erro ao obter coordenadas:', error);
    throw new Error('Erro ao obter coordenadas da API.');
  }
};

//lojista

app.post('/lojistas', async (req, res) => {
  const { nome, sobrenome, cpf, dataNasc, nomeEmpresa, cnpj, cep, logradouro, cidade, estado, numEstab, complemento, numcontato, email, senha } = req.body;

  try {
    // Obtenha a latitude e longitude usando a função
    const estado = req.body.estado || ''; // Inclua o estado se necessário
    const { latitude, longitude } = await obterCoordenadas(logradouro, cidade, estado);

    // Crie o lojista com os dados e as coordenadas
    const lojista = await prisma.lojista.create({
      data: {
        nome,
        sobrenome,
        cpf,
        dataNasc,
        nomeEmpresa,
        cnpj,
        cep,
        logradouro,
        cidade,
        estado,
        numEstab,
        complemento,
        numcontato,
        email,
        senha,
        latitude,
        longitude,
      }
    });

    res.status(201).json(lojista);
  } catch (error) {
    console.error('Erro ao criar lojista:', error.message);
    res.status(500).json({ message: error.message || 'Erro no servidor. Tente novamente mais tarde.' });
  }
});


// Rota para listar lojistas
app.get('/lojistas', async (req, res) => {
  const { nome, email } = req.query;

  try {
    const lojistas = await prisma.lojista.findMany({
      where: {
        AND: [
          nome ? { nome: { contains: nome, mode: 'insensitive' } } : {},
          email ? { email: { contains: email, mode: 'insensitive' } } : {}
        ]
      }
    });
    res.status(200).json(lojistas);
  } catch (error) {
    console.error('Erro ao listar lojistas:', error);
    res.status(500).json({ message: 'Erro no servidor. Tente novamente mais tarde.' });
  }
});

// Rota para atualizar um lojista
app.put('/lojistas/:id', async (req, res) => {
  const { nome, sobrenome, cpf, dataNasc, nomeEmpresa, cnpj, cep, logradouro, cidade, estado, numEstab, complemento, numcontato, email, senha } = req.body;

  try {
    // Verifique se algum campo de endereço foi alterado
    let latitude, longitude;
    if (logradouro || cidade || estado) {
      const estado = req.body.estado || ''; // Inclua o estado se necessário
      // Obtenha as novas coordenadas com base no novo endereço
      ({ latitude, longitude } = await obterCoordenadas(logradouro, cidade, estado));
    }

    // Atualize o lojista com os novos dados, incluindo latitude e longitude (se houver)
    const lojistaAtualizado = await prisma.lojista.update({
      where: {
        id: req.params.id
      },
      data: {
        nome,
        sobrenome,
        cpf,
        dataNasc,
        nomeEmpresa,
        cnpj,
        cep,
        logradouro,
        cidade,
        estado,
        numEstab,
        complemento,
        numcontato,
        email,
        senha,
        latitude,   // Atualiza a latitude, se recalculada
        longitude,  // Atualiza a longitude, se recalculada
      }
    });

    res.status(200).json(lojistaAtualizado);
  } catch (error) {
    console.error('Erro ao atualizar lojista:', error);
    res.status(500).json({ message: 'Erro no servidor. Tente novamente mais tarde.' });
  }
});


// Rota para deletar um lojista
app.delete('/lojistas/:id', async (req, res) => {
  try {
    await prisma.lojista.delete({
      where: {
        id: req.params.id
      }
    });
    res.status(200).json({ message: "Lojista deletado com sucesso!" });
  } catch (error) {
    console.error('Erro ao deletar lojista:', error);
    res.status(500).json({ message: 'Erro no servidor. Tente novamente mais tarde.' });
  }
});

// Rota para login de lojistas
app.post('/login/lojistas', async (req, res) => {
  const { email, senha } = req.body;

  try {
    const lojista = await prisma.lojista.findUnique({
      where: { email: email },
    });

    if (lojista && lojista.senha === senha) {
      res.status(200).json({ message: 'Login bem-sucedido!', lojista });
    } else {
      res.status(401).json({ message: 'Email ou senha incorretos!' });
    }
  } catch (error) {
    console.error('Erro ao fazer login do lojista:', error);
    res.status(500).json({ message: 'Erro no servidor. Tente novamente mais tarde.' });
  }
});


//produtos

app.get('/produtos', async (req, res) => {
  try {
    const { id, nome, idLojista } = req.query;

    let produtos = [];

    

    if (id) {
      const produto = await prisma.produto.findUnique({
        where: { id: id }
      });
      if (produto) {
        produtos = [produto];
      } else {
        return res.status(404).json({ message: 'Produto não encontrado' });
      }
    } else {
      produtos = await prisma.produto.findMany({
        where: {
          AND: [
            nome ? { nome: { contains: nome, mode: 'insensitive' } } : {},
            idLojista ? { idLojista: idLojista } : {}
          ]
        }
      });
      
    }

    const produtosFiltrados = produtos.filter(produto => produto.preco !== null);

    res.json(produtosFiltrados);
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    res.status(500).json({ message: 'Erro ao buscar produtos.', error: error.message });
  }
});


app.post('/produtos', async (req, res) => {
  try {
    const { nome, descricao, idLojista, imagemProduto } = req.body;

    const novoProduto = await prisma.produto.create({
      data: {
        nome,
        descricao,
        idLojista,
        imagemProduto
      }
    });

    res.status(201).json({
      message: "Produto novo adicionado com sucesso",
      novoProduto
  });
  } catch (error) {
    console.error('Erro ao criar produto:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

app.put('/produtos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, descricao, idLojista, imagemProduto } = req.body;

    const produtoAtualizado = await prisma.produto.update({
      where: { id: id },
      data: {
        nome,
        descricao,
        idLojista,
        imagemProduto
      }
    });

    res.status(200).json({
      message: "Produto atualizado com sucesso",
      produtoAtualizado
  });
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

app.delete('/produtos/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.produto.delete({
      where: { id: id }
    });

    res.status(200).json({ message: 'Produto deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar produto:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

//geolocalização
app.get('/busca', async (req, res) => {
  const { termo = '', latitude, longitude } = req.query;

  // Verificação básica dos parâmetros de latitude e longitude
  if (!latitude || !longitude) {
    return res.status(400).json({ message: 'Latitude e longitude são obrigatórios.' });
  }

  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);
  const raio = 5000; // Raio fixo de 10 km

  try {
    // Logs para depuração
    console.log('Parâmetros de busca:', { termo, latitude, longitude, raio });

    const lojistas = await prisma.lojista.findMany({
      where: {
        OR: [
          { nome: { contains: termo, mode: 'insensitive' } },
          { nomeEmpresa: { contains: termo, mode: 'insensitive' } },
        ],
      },
    });

    // Verifique se há lojistas
    if (lojistas.length === 0) {
      return res.status(200).json({
        message: `Nenhum lojista encontrado com o termo "${termo}".`,
      });
    }

    const lojistasFiltrados = lojistas.filter(lojista => {
      const distancia = geolib.getDistance(
        { latitude: lojista.latitude, longitude: lojista.longitude },
        { latitude: lat, longitude: lon }
      );

      return distancia <= raio;
    });

    if (lojistasFiltrados.length === 0) {
      return res.status(200).json({
        message: `Nenhum lojista encontrado dentro de ${raio / 1000} km da sua localização.`,
      });
    }

    // Adiciona a distância formatada
    const lojistasComDistancia = lojistasFiltrados.map(lojista => {
      const distancia = geolib.getDistance(
        { latitude: lojista.latitude, longitude: lojista.longitude },
        { latitude: lat, longitude: lon }
      );

      return {
        ...lojista,
        distancia,
        distanciaFormatada: (distancia / 1000).toFixed(2) + " km",
      };
    });

    res.status(200).json({ lojistas: lojistasComDistancia });
  } catch (error) {
    console.error('Erro ao buscar produtos ou estabelecimentos:', error);
    res.status(500).json({ message: 'Erro no servidor. Tente novamente mais tarde.' });
  }
});

// Nova Função de Busca para Produtos
app.get('/busca-produtos', async (req, res) => {
  const { termo = '', latitude, longitude } = req.query;

  // Verificação básica dos parâmetros de latitude e longitude
  if (!latitude || !longitude) {
    return res.status(400).json({ message: 'Latitude e longitude são obrigatórios.' });
  }

  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);
  const raio = 5000; // Raio fixo de 10 km

  try {
    // Logs para depuração
    console.log('Parâmetros de busca de produtos:', { termo, latitude, longitude, raio });

    // Busca produtos que correspondam ao termo e inclui informações do lojista
    const produtos = await prisma.produto.findMany({
      where: {
        nome: { contains: termo, mode: 'insensitive' },
      },
      include: {
        lojista: true,
      },
    });

    // Verifica se há produtos encontrados
    if (produtos.length === 0) {
      return res.status(200).json({
        message: `Nenhum produto encontrado com o termo "${termo}".`,
      });
    }

    // Filtra produtos com base na distância do lojista
    const produtosFiltrados = produtos.filter(produto => {
      const distancia = geolib.getDistance(
        { latitude: produto.lojista.latitude, longitude: produto.lojista.longitude },
        { latitude: lat, longitude: lon }
      );

      return distancia <= raio;
    });

    if (produtosFiltrados.length === 0) {
      return res.status(200).json({
        message: `Nenhum produto encontrado dentro de ${raio / 1000} km da sua localização.`,
      });
    }

    res.status(200).json(produtosFiltrados);
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    res.status(500).json({ message: 'Erro no servidor. Tente novamente mais tarde.' });
  }
});


 app.listen(4000)
 
 /*
    Criar nossa API de Usuarios
    -Criar um usuário
    -Listar todos os usuários
    -Editar um usuário
    -Deletar um usuário
 */


 /*
    1) Tipo de Rota / Metodo HTTP
    2) Endereço

 */

