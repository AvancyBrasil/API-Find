import express from 'express'
import cors from 'cors'
import { PrismaClient } from '@prisma/client'
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import fetch from 'node-fetch'; 
import geolib from 'geolib';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';
import streamifier from 'streamifier';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const prisma = new PrismaClient();
const app = express();
app.use(express.json());
app.use(cors());

// Configuração do Multer para armazenamento em memória
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Rota para criar um usuário com upload de foto de perfil
app.post('/usuarios', upload.single('fotoPerfil'), async (req, res) => {
  const { nome, cpf, dataNasc, telefone, cep, logradouro, bairro, cidade, email, senha } = req.body;
  const fotoPerfil = req.file ? req.file.buffer : null;

  try {
    let fotoPerfilPublicId = null;

    // Fazer upload da imagem para o Cloudinary
    if (fotoPerfil) {
      const cloudinaryResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { resource_type: 'image', folder: 'usuarios' },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        streamifier.createReadStream(fotoPerfil).pipe(stream);
      });

      fotoPerfilPublicId = cloudinaryResult.public_id;
    }

    // Criar o usuário no banco de dados
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
        fotoPerfil: fotoPerfilPublicId,
      }
    });

    return res.status(201).json(usuario);
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ message: 'Erro ao criar usuário.' });
  }
});

// Rota para atualizar um usuário com nova foto de perfil
app.put('/usuarios/:id', upload.single('fotoPerfil'), async (req, res) => {
  const { nome, cpf, dataNasc, telefone, cep, logradouro, bairro, cidade, email, senha } = req.body;
  const fotoPerfil = req.file ? req.file.buffer : undefined;

  try {
    // Buscar o usuário existente para verificar a foto atual
    const usuarioExistente = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!usuarioExistente) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    let fotoPerfilPublicId = usuarioExistente.fotoPerfil;

    // Atualizar a foto no Cloudinary se uma nova foto foi enviada
    if (fotoPerfil) {
      // Excluir a foto antiga, se houver
      if (fotoPerfilPublicId) {
        await cloudinary.uploader.destroy(fotoPerfilPublicId);
      }

      // Fazer upload da nova foto
      const cloudinaryResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { resource_type: 'image', folder: 'usuarios' },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        streamifier.createReadStream(fotoPerfil).pipe(stream);
      });

      fotoPerfilPublicId = cloudinaryResult.public_id;
    }

    // Atualizar os dados do usuário
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
        fotoPerfil: fotoPerfilPublicId,
      }
    });

    return res.status(200).json(usuarioAtualizado);
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ message: 'Erro ao atualizar usuário.' });
  }
});
  
  app.get('/usuarios', async (req, res) => {
    try {
      const { id, nome, email } = req.query;
  
      let usuarios = [];
  
      // Se o id for fornecido, buscamos pelo id
      if (id) {
        // Busca um usuário específico pelo ID (sem conversão para int)
        const usuario = await prisma.user.findUnique({
          where: { id: id }  // ID agora é passado diretamente como string
        });
  
        if (usuario) {
          usuarios = [usuario];
        } else {
          return res.status(404).json({ message: 'Usuário não encontrado' });
        }
      } else {
        // Caso o id não seja fornecido, buscamos pelos filtros nome e email
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
  const { email, senha, status} = req.body;
  console.log('Tentativa de login com:', { email, senha });

  try {
    const usuario = await prisma.user.findUnique({
      where: { email: email },
    });
    console.log('Usuário encontrado:', usuario);
    if (usuario) {
   
      if (senha === usuario.senha) {
        if (usuario.status === true) {
          res.status(200).json({ message: 'Login bem-sucedido!', usuario });
        } else {
          res.status(403).json({ message: 'Conta banida. Entre em contato com o suporte.' });
        }
      } else {
        res.status(401).json({ message: 'Email ou senha incorretos!' });
      }
    } else {
      res.status(401).json({ message: 'Email ou senha incorretos!' });
    }
  } catch (error) {
    console.error('Erro ao fazer login do lojista:', error);
    res.status(500).json({ message: 'Erro no servidor. Tente novamente mais tarde.' });
  }
});

//função banir
app.put('/usuarios/:id/banir', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // Espera um valor booleano para definir o status

  // Verifica se o status é um booleano
  if (typeof status !== 'boolean') {
    return res.status(400).json({ message: 'O campo "status" deve ser um valor booleano (true para ativo, false para banido).' });
  }

  try {
    const usuario = await prisma.user.update({
      where: { id: id },
      data: { status: status }, // Atualiza o status diretamente para o valor recebido
    });

    res.status(200).json({
      message: status ? 'Usuário ativado com sucesso!' : 'Usuário banido com sucesso!',
      usuario,
    });
  } catch (error) {
    console.error('Erro ao atualizar status do usuário:', error);
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

app.post('/lojistas', upload.single('imagemLojista'), async (req, res) => {
  const { nome, sobrenome, cpf, dataNasc, nomeEmpresa, cnpj, cep, logradouro, cidade, estado, numEstab, complemento, numContato, email, senha, categoria, rating, numeroAvaliacoes, horarioFuncionamento, descricao, biografia, avaliacao, subcategoria } = req.body;
  const imagemLojista = req.file ? req.file.buffer : null;

  try {
    let imagemLojistaPublicId = null;

    // Fazer upload da imagem para o Cloudinary
    if (imagemLojista) {
      const cloudinaryResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { resource_type: 'image', folder: 'lojistas' },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        streamifier.createReadStream(imagemLojista).pipe(stream);
      });

      imagemLojistaPublicId = cloudinaryResult.public_id;
    }

    // Obter as coordenadas com base no endereço
    const estado = req.body.estado || '';
    const { latitude, longitude } = await obterCoordenadas(logradouro, cidade, estado);

    // Criar o lojista no banco de dados
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
        numContato,
        email,
        senha,
        latitude,
        longitude,
        biografia,
        avaliacao,
        subcategoria,
        categoria,
        rating,
        numeroAvaliacoes,
        horarioFuncionamento,
        descricao,
        imagemLojista: imagemLojistaPublicId,
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
  const { id, nome, email, categoria, latitude, longitude } = req.query;

  try {
    // Caso um ID específico seja passado
    if (id) {
      const lojista = await prisma.lojista.findUnique({
        where: { id: id }, // Prisma espera uma string válida aqui
      });

      // Verifica se o lojista foi encontrado
      if (!lojista) {
        return res.status(404).json({ message: 'Lojista não encontrado.' });
      }

      // Se latitude e longitude forem fornecidas, calcular a distância
      if (latitude && longitude) {
        const lat = parseFloat(latitude);
        const lon = parseFloat(longitude);

        const distancia = geolib.getDistance(
          { latitude: lojista.latitude, longitude: lojista.longitude },
          { latitude: lat, longitude: lon }
        );

        // Adiciona a distância ao objeto do lojista
        return res.status(200).json({ ...lojista, distancia });
      }

      return res.status(200).json(lojista);
    }

    // Busca por múltiplos lojistas usando outros filtros
    const lojistas = await prisma.lojista.findMany({
      where: {
        AND: [
          nome ? { nome: { contains: nome, mode: 'insensitive' } } : {},
          email ? { email: { contains: email, mode: 'insensitive' } } : {},
          categoria ? { categoria: { contains: categoria, mode: 'insensitive' } } : {},
        ],
      },
    });

    // Se latitude e longitude forem fornecidas, calcular a distância para cada lojista
    if (latitude && longitude) {
      const lat = parseFloat(latitude);
      const lon = parseFloat(longitude);
      const raio = 20000; // Raio de 20 km

      const lojistasComDistancia = lojistas
        .map(lojista => {
          const distancia = geolib.getDistance(
            { latitude: lojista.latitude, longitude: lojista.longitude },
            { latitude: lat, longitude: lon }
          );

          return { ...lojista, distancia };
        })
        .filter(lojista => lojista.distancia <= raio)
        .sort((a, b) => a.distancia - b.distancia);

      if (lojistasComDistancia.length === 0) {
        return res.status(200).json({
          message: `Nenhum lojista encontrado dentro de ${raio / 1000} km da sua localização.`,
        });
      }

      const resultado = lojistasComDistancia.map(lojista => ({
        ...lojista,
        distanciaFormatada: (lojista.distancia / 1000).toFixed(2) + ' km',
      }));

      return res.status(200).json({ lojistas: resultado });
    }

    // Caso contrário, apenas retorna os lojistas encontrados
    res.status(200).json(lojistas);
  } catch (error) {
    console.error('Erro ao listar lojistas:', error);
    res.status(500).json({ message: 'Erro no servidor. Tente novamente mais tarde.' });
  }
});



// Rota para atualizar um lojista
app.put('/lojistas/:id', upload.single('imagemLojista'), async (req, res) => {
  const { nome, sobrenome, cpf, dataNasc, nomeEmpresa, cnpj, cep, logradouro, cidade, estado, numEstab, complemento, numContato, email, senha, categoria, rating, numeroAvaliacoes, horarioFuncionamento, descricao, biografia, avaliacao, subcategoria } = req.body;
  const imagemLojista = req.file ? req.file.buffer : undefined;

  try {
    // Buscar o lojista existente
    const lojistaExistente = await prisma.lojista.findUnique({ where: { id: req.params.id } });
    if (!lojistaExistente) {
      return res.status(404).json({ message: 'Lojista não encontrado.' });
    }

    let imagemLojistaPublicId = lojistaExistente.imagemLojista;

    if (imagemLojista) {
      // Apagar a imagem anterior no Cloudinary
      if (imagemLojistaPublicId) {
        await cloudinary.uploader.destroy(imagemLojistaPublicId);
      }

      // Fazer upload da nova imagem
      const cloudinaryResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { resource_type: 'image', folder: 'lojistas' },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        streamifier.createReadStream(imagemLojista).pipe(stream);
      });

      imagemLojistaPublicId = cloudinaryResult.public_id;
    }

    // Obter as coordenadas, caso o endereço tenha sido alterado
    let latitude, longitude;
    if (logradouro || cidade || estado) {
      const estado = req.body.estado || ''; 
      ({ latitude, longitude } = await obterCoordenadas(logradouro, cidade, estado));
    }

    // Atualizar o lojista no banco de dados
    const lojistaAtualizado = await prisma.lojista.update({
      where: { id: req.params.id },
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
        numContato,
        email,
        senha,
        imagemLojista: imagemLojistaPublicId,
        latitude,
        longitude,
        biografia,
        avaliacao,
        subcategoria,
        categoria,
        rating,
        numeroAvaliacoes,
        horarioFuncionamento,
        descricao,
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
  const { email, senha, status} = req.body;

  try {
    const lojista = await prisma.lojista.findUnique({
      where: { email: email },
    });
    if (lojista) {
   
      if (senha === lojista.senha) {
        if (lojista.status === true) {
          res.status(200).json({ message: 'Login bem-sucedido!', lojista });
        } else {
          res.status(403).json({ message: 'Conta inativa. Entre em contato com o suporte.' });
        }
      } else {
        res.status(401).json({ message: 'Email ou senha incorretos!' });
      }
    } else {
      res.status(401).json({ message: 'Email ou senha incorretos!' });
    }
  } catch (error) {
    console.error('Erro ao fazer login do lojista:', error);
    res.status(500).json({ message: 'Erro no servidor. Tente novamente mais tarde.' });
  }
});

//função banir
app.put('/lojistas/:id/banir', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // Espera um valor booleano para definir o status

  // Verifica se o status é um booleano
  if (typeof status !== 'boolean') {
    return res.status(400).json({ message: 'O campo "status" deve ser um valor booleano (true para ativo, false para banido).' });
  }

  try {
    const lojista = await prisma.lojista.update({
      where: { id: id },
      data: { status: status }, 
    });

    res.status(200).json({
      message: status ? 'Lojista ativado com sucesso!' : 'Lojista banido com sucesso!',
      lojista,
    });
  } catch (error) {
    console.error('Erro ao atualizar status do lojista:', error);
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
        where: { AND: [
          id ? { id: { contains: nome, mode: 'insensitive' } } : {},
          idLojista ? { idLojista: { contains: idLojista, mode: 'insensitive' } } : {}
        ] }
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
    console.log('Corpo da requisição:', req.body);

    const { nome, descricao, preco, categoria, subcategoria, avaliacao, rating, idLojista, imagemProduto } = req.body;

    // Verificar se todos os campos obrigatórios foram enviados
    if (!nome || !descricao || !preco || !categoria || !idLojista) {
      return res.status(400).json({ message: 'Todos os campos obrigatórios devem ser preenchidos' });
    }

    // Verificar se a imagemProduto foi fornecida
    if (!imagemProduto) {
      return res.status(400).json({ message: 'Link da imagem é necessário' });
    }

    // Criar novo produto no banco de dados
    const novoProduto = await prisma.produto.create({
      data: {
        nome,
        descricao,
        preco,
        categoria,
        subcategoria,
        rating,
        avaliacao: avaliacao ? parseFloat(avaliacao) : null, 
        idLojista,
        imagemProduto,
      }
    });

    // Enviar resposta de sucesso
    res.status(201).json({
      message: "Produto novo adicionado com sucesso",
      novoProduto
    });
  } catch (error) {
    console.error('Erro ao criar produto:', error);
    
    // Enviar resposta com detalhes do erro
    res.status(500).json({ 
      message: 'Erro interno do servidor',
      error: error.message // Detalhes do erro para diagnóstico
    });
  }
});

app.put('/produtos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {  nome, descricao, preco,categoria,subcategoria, avaliacao, idLojista,rating,imagemProduto } = req.body;

    const produtoAtualizado = await prisma.produto.update({
      where: { id: id },
      data: {
        nome,
        descricao,
        preco,
        categoria,
        subcategoria,
        rating,
        avaliacao: avaliacao ? parseFloat(avaliacao) : null,
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

//novas funções
app.get('/lojistas-proximos', async (req, res) => {
  const { latitude, longitude } = req.query;

  if (!latitude || !longitude) {
    return res.status(400).json({ message: 'Latitude e longitude são obrigatórios.' });
  }

  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);
  const raio = 1000000; // Raio de 20 km

  try {
    console.log('Parâmetros de busca:', { latitude, longitude, raio });

    const lojistas = await prisma.lojista.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
      },
    });

    if (lojistas.length === 0) {
      return res.status(200).json({ message: 'Nenhum lojista encontrado.' });
    }

    const lojistasComDistancia = lojistas
      .map(lojista => {
        const distancia = geolib.getDistance(
          { latitude: lojista.latitude, longitude: lojista.longitude },
          { latitude: lat, longitude: lon }
        );

        return { ...lojista, distancia };
      })
      .filter(lojista => lojista.distancia <= raio)
      .sort((a, b) => a.distancia - b.distancia);

    if (lojistasComDistancia.length === 0) {
      return res.status(200).json({
        message: `Nenhum lojista encontrado dentro de ${raio / 1000} km da sua localização.`,
      });
    }

    const resultado = lojistasComDistancia.map(lojista => ({
      ...lojista,
      distanciaFormatada: (lojista.distancia / 1000).toFixed(2) + ' km',
    }));

    console.log('Lojistas encontrados com distância:', resultado); // Para depuração

    res.status(200).json({ lojistas: resultado });
  } catch (error) {
    console.error('Erro ao buscar lojistas próximos:', error);
    res.status(500).json({ message: 'Erro no servidor. Tente novamente mais tarde.' });
  }
});


app.get('/lojistas-melhor-avaliados', async (req, res) => {
  const { latitude, longitude } = req.query;

  if (!latitude || !longitude) {
    return res.status(400).json({ message: 'Latitude e longitude são obrigatórios.' });
  }

  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);
  const raio = 1000000; // Raio de 20 km

  try {
    const lojistas = await prisma.lojista.findMany({
      where: {
        avaliacao: { gte: 4.0 }, // Filtra lojistas com avaliação maior ou igual a 4.0
      },
      orderBy: {
        avaliacao: 'desc', // Ordena em ordem decrescente
      },
    });

    if (lojistas.length === 0) {
      return res.status(200).json({ message: 'Nenhum lojista encontrado com avaliação igual ou superior a 4.0.' });
    }


    
    // Calcular a distância apenas se as coordenadas forem fornecidas
    const resultado = lojistas.map(lojista => {
      const distancia = geolib.getDistance(
        { latitude: lojista.latitude, longitude: lojista.longitude },
        { latitude: lat, longitude: lon }
      );

      return {
        id: lojista.id,
        nome: lojista.nome,
        avaliacao: lojista.avaliacao,
        imagemLojista: lojista.imagemLojista, // Adiciona a imagem do lojista
        categoria: lojista.categoria, // Adiciona a categoria do lojista
        distancia: distancia,
        distanciaFormatada: (distancia / 1000).toFixed(2) + ' km', // Formata a distância
      };
    });

    console.log('Lojistas encontrados com avaliações superiores a 4.0:', resultado); // Para depuração

    res.status(200).json({ lojistas: resultado });
  } catch (error) {
    console.error('Erro ao buscar lojistas melhor avaliados:', error);
    res.status(500).json({ message: 'Erro no servidor. Tente novamente mais tarde.' });
  }
});






//contar Usuarios
async function contarUsuarios() {
  const uri = process.env.DATABASE_URL; 
  const client = new MongoClient(uri);
  let totalCount = 0;

  try {
    await client.connect();
    const database = client.db('Usuarios');

    
    const collection1 = database.collection('User'); 
    const count1 = await collection1.countDocuments();


    const collection2 = database.collection('Lojista'); 
    const count2 = await collection2.countDocuments();

    
    totalCount = count1 + count2;
  } catch (error) {
    console.error("Erro ao contar os documentos:", error);
  } finally {
    await client.close();
  }

  return totalCount;
}


app.get('/usuariosTotal', async (req, res) => {
  const totalCount = await contarUsuarios();
  res.send(`${totalCount}`);
});

async function contarUsuariosPorStatus() {
  try {

    const usuarios = await prisma.user.findMany();
    const lojistas = await prisma.lojista.findMany();

    const todosUsuarios = [...usuarios, ...lojistas];

    const usuariosAtivos = todosUsuarios.filter(usuario => usuario.status === true).length;
    const usuariosInativos = todosUsuarios.filter(usuario => usuario.status === false).length;

    return { usuariosAtivos, usuariosInativos };

  } catch (error) {
    console.error("Erro ao buscar e contar usuários:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Rota GET para retornar contagens de usuários ativos e inativos
app.get('/usuariosStatus', async (req, res) => {
  try {
    const { usuariosAtivos, usuariosInativos } = await contarUsuariosPorStatus();
    res.json({ usuariosAtivos, usuariosInativos });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar contagem de usuários' });
  }
});



//Validação do Lojista

app.get('/validacao', async (req, res) => {
  const { nome, email } = req.query;

  try {
    const lojistas = await prisma.validacao.findMany({
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


app.post('/validacao', async (req, res) => {
  const { nome, sobrenome, cpf, dataNasc, nomeEmpresa, cnpj, cep, logradouro, cidade, estado, numEstab, complemento, numContato, email, senha } = req.body;

  try {
    const existingLojista = await prisma.validacao.findUnique({
      where: { email }
    });

    if (existingLojista) {
      return res.status(400).json({ message: 'Esse email já está cadastrado.' });
    }

    // Cria um novo lojista se o email não existir
    const lojista = await prisma.validacao.create({
      data: {
        nome,
        sobrenome,
        nomeEmpresa,
        cnpj,
        cep,
        logradouro,
        cidade,
        estado,
        numEstab,
        numContato,
        email,
        senha,
      }
    });

    res.status(201).json(lojista);
  } catch (error) {
    console.error('Erro ao criar lojista:', error.message);
    // Se o erro for um erro de violação de unicidade, trata separadamente
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Esse email já está cadastrado.' });
    }
    res.status(500).json({ message: error.message || 'Erro no servidor. Tente novamente mais tarde.' });
  }
});

app.delete('/validacao/:id', async (req, res) => {
  try {
    await prisma.validacao.delete({
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


//enviar email 
const transporter = nodemailer.createTransport({
  host: 'in-v3.mailjet.com',
  port: 587,
  secure: false,
  auth: {
    user: '4f2e051acca82d5dac5cf5b3d9d532ff', 
    pass: '126cdb5072a67affbdbb1c7f19bd79a5',
  },
});

// Rota para enviar email
app.post('/validacao/emailAprovado', async (req, res) => {
  const { to, subject, message } = req.body;

  const mailOptions = {
    from: 'avancynew@gmail.com',
    to,
    subject,
    text: message,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Email enviado com sucesso.' });
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    res.status(500).json({ message: 'Erro ao enviar email.' });
  }
});

//seguidores 
// POST /seguir
app.post('/seguir', async (req, res) => {
  const { userId, lojistaId } = req.body;

  try {
    // Verifica se o relacionamento já existe
    const existingFollow = await prisma.userFollowLojista.findFirst({
      where: {
        userId,
        lojistaId,
      },
    });

    if (existingFollow) {
      return res.status(400).json({ mensagem: 'Você já está seguindo este lojista.' });
    }

    // Cria o relacionamento de seguir
    const follow = await prisma.userFollowLojista.create({
      data: {
        userId,
        lojistaId,
      },
    });

    res.json({ mensagem: 'Lojista seguido com sucesso!', follow });
  } catch (error) {
    res.status(500).json({ mensagem: 'Erro ao seguir o lojista.', error });
  }
});

// DELETE /deixar-seguir
app.delete('/deixar-seguir', async (req, res) => {
  const { userId, lojistaId } = req.body;

  try {
    // Remove o relacionamento de seguir
    await prisma.userFollowLojista.deleteMany({
      where: {
        userId,
        lojistaId,
      },
    });

    res.json({ mensagem: 'Você deixou de seguir o lojista com sucesso!' });
  } catch (error) {
    res.status(500).json({ mensagem: 'Erro ao deixar de seguir o lojista.', error });
  }
});
// GET /verificar-seguindo
app.get('/verificar-seguindo', async (req, res) => {
  const { userId, lojistaId } = req.query;

  try {
    // Verifica se o relacionamento de seguir existe
    const existingFollow = await prisma.userFollowLojista.findFirst({
      where: {
        userId,
        lojistaId,
      },
    });

    if (existingFollow) {
      // Se existe, significa que o usuário já está seguindo
      return res.json({ isFollowing: true, mensagem: 'Você já está seguindo este lojista.' });
    }

    // Se não encontrou, significa que o usuário não está seguindo
    res.json({ isFollowing: false, mensagem: 'Você ainda não está seguindo este lojista.' });
  } catch (error) {
    res.status(500).json({ mensagem: 'Erro ao verificar o status de seguir.', error });
  }
});


// GET /produtos-seguindo
app.get('/produtos-seguindo', async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ mensagem: 'userId é obrigatório.' });
  }

  try {
    // 1. Verifica se o usuário existe
    const userExists = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!userExists) {
      return res.status(404).json({ mensagem: 'Usuário não encontrado.' });
    }

    console.log("Usuário encontrado:", userExists);

    // 2. Busca os lojistas que o usuário segue
    const following = await prisma.userFollowLojista.findMany({
      where: { userId },
      select: { lojistaId: true },
    });

    console.log("Lojistas seguidos:", following);

    if (following.length === 0) {
      return res.json({ mensagem: "Você não está seguindo nenhum lojista.", produtos: [] });
    }

    // Extrai os IDs dos lojistas seguidos
    const lojistasSeguidos = following.map(follow => follow.lojistaId);

    console.log("IDs dos lojistas seguidos:", lojistasSeguidos);

    // 3. Busca os produtos para cada lojista seguido individualmente
    let produtos = [];
    for (const lojistaId of lojistasSeguidos) {
      const produtosDoLojista = await prisma.produto.findMany({
        where: {
          idLojista: lojistaId,
          status: true,
        },
        include: {
          lojista: {
            select: {
              id: true,
              nomeEmpresa: true,
              imagemLojista: true,
            }
          },
        },
      });
      console.log(`Produtos do lojista ${lojistaId}:`, produtosDoLojista);
      produtos = produtos.concat(produtosDoLojista);
    }

    if (produtos.length === 0) {
      return res.json({ mensagem: "Não há produtos disponíveis dos lojistas que você segue.", produtos: [] });
    }

    return res.json({
      mensagem: "Produtos dos lojistas que você segue.",
      produtos,
    });
  } catch (error) {
    console.error("Erro ao buscar produtos:", error);
    res.status(500).json({ mensagem: 'Erro ao buscar produtos.', error });
  }
});



app.post('/avaliar-lojista', async (req, res) => {
  const { lojistaId, usuarioId, nota, comentario } = req.body;

  if (!lojistaId || !usuarioId || nota === undefined) {
    return res.status(400).json({ mensagem: 'Lojista, usuário e nota são obrigatórios.' });
  }

  if (nota < 1 || nota > 5) {
    return res.status(400).json({ mensagem: 'A nota deve estar entre 1 e 5.' });
  }

  try {
    // Verifica se o lojista existe
    const lojista = await prisma.lojista.findUnique({
      where: { id: lojistaId },
      include: { avaliacoes: true }
    });

    if (!lojista) {
      return res.status(404).json({ mensagem: 'Lojista não encontrado.' });
    }

    // Cria a nova avaliação
    const novaAvaliacao = await prisma.avaliacao.create({
      data: {
        usuarioId,
        lojistaId,
        nota,
        comentario
      }
    });

    // Calcula a média atualizada
    const totalAvaliacoes = lojista.avaliacoes.length + 1;
    const somaAvaliacoes = lojista.avaliacoes.reduce((acc, avaliacao) => acc + avaliacao.nota, nota);
    const novaMedia = parseFloat((somaAvaliacoes / totalAvaliacoes).toFixed(2));

    // Atualiza o rating do lojista
    await prisma.lojista.update({
      where: { id: lojistaId },
      data: { avaliacao: novaMedia }
    });

    res.status(201).json({
      mensagem: 'Avaliação registrada com sucesso!',
      novaAvaliacao,
      novaMedia
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensagem: 'Erro ao registrar a avaliação.', error });
  }
}); 


// Função para obter avaliações de um lojista
const getAvaliacoesByLojistaId = async (req, res) => {
  const { lojistaId } = req.params; // Pega o id do lojista da URL

  try {
    const avaliacoes = await prisma.avaliacao.findMany({
      where: {
        lojistaId: lojistaId, // Filtra as avaliações para um lojista específico
      },
      include: {
        usuario: true, // Inclui os dados do usuário que fez a avaliação
      },
    });

    // Verifica se o lojista tem avaliações
    if (avaliacoes.length === 0) {
      return res.status(404).json({ message: 'Nenhuma avaliação encontrada para este lojista.' });
    }

    // Retorna as avaliações encontradas
    return res.status(200).json(avaliacoes);
  } catch (error) {
    console.error('Erro ao buscar avaliações:', error);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};


app.get('/avaliacoes2/lojista/:lojistaId', async (req, res) => {
  const { lojistaId } = req.params; // Pega o id do lojista da URL

  try {
    // Verifica se o lojista existe
    const lojista = await prisma.lojista.findUnique({
      where: { id: lojistaId },
      include: { avaliacoes: true } // Inclui as avaliações associadas ao lojista
    });

    if (!lojista) {
      return res.status(404).json({ mensagem: 'Lojista não encontrado.' });
    }

    // Retorna as avaliações do lojista
    if (lojista.avaliacoes.length === 0) {
      return res.status(404).json({ mensagem: 'Nenhuma avaliação encontrada para este lojista.' });
    }

    res.status(200).json({
      mensagem: 'Avaliações encontradas com sucesso!',
      avaliacoes: lojista.avaliacoes
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensagem: 'Erro ao buscar as avaliações.', error });
  }
});

app.get('/avaliacoes/lojista/:id', async (req, res) => {
  const { id } = req.params;  // Obtém o id do lojista a partir dos parâmetros da URL

  try {
    // Consultando as avaliações do lojista
    const avaliacoes = await prisma.avaliacao.findMany({
      where: {
        lojistaId: id,  // Filtrando pelas avaliações do lojista específico
      },
      include: {
        usuario: true,  // Incluindo as informações do usuário que fez a avaliação
      },
    });

    // Retornando as avaliações encontradas
    res.json(avaliacoes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar avaliações' });
  }
});

app.get('/lojista/:lojistaId/seguidores', async (req, res) => {
  const { lojistaId } = req.params; // pegando o lojistaId da URL

  try {
    // Buscando o número de seguidores
    const followersCount = await prisma.userFollowLojista.count({
      where: {
        lojistaId: lojistaId
      }
    });

    // Buscando os seguidores do lojista
    const followers = await prisma.userFollowLojista.findMany({
      where: {
        lojistaId: lojistaId
      },
      include: {
        user: true, // Incluindo os detalhes dos usuários que seguem
      }
    });

    // Retornando a resposta com o número de seguidores e a lista de seguidores
    res.status(200).json({
      followersCount,
      followers: followers.map(follow => follow.user), // retornando apenas as informações do usuário
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar seguidores do lojista' });
  }
});


// Endpoint POST para adicionar um produto aos favoritos
app.post('/adicionar-favorito', async (req, res) => {
  const { userId, produtoId } = req.body;

  // Verifica se os parâmetros foram passados
  if (!userId || !produtoId) {
    return res.status(400).json({ message: 'userId e produtoId são necessários.' });
  }

  try {
    // Verifica se o produto já está nos favoritos do usuário
    const produtoFavoritoExistente = await prisma.produtoFavorito.findFirst({
      where: {
        userId: userId,
        produtoId: produtoId,
      },
    });

    if (produtoFavoritoExistente) {
      return res.status(400).json({ message: 'Produto já está nos favoritos.' });
    }

    // Adiciona o produto aos favoritos
    const produtoFavorito = await prisma.produtoFavorito.create({
      data: {
        userId: userId,
        produtoId: produtoId,
      },
    });

    return res.status(201).json({ message: 'Produto adicionado aos favoritos.', produtoFavorito });
  } catch (error) {
    console.error("Erro ao adicionar produto aos favoritos:", error);
    return res.status(500).json({ message: 'Erro ao adicionar produto aos favoritos.', error: error.message });
  }
});


// Rota para verificar se o produto está nos favoritos
app.get('/verificar-favorito/:userId/:produtoId', async (req, res) => {
  const { userId, produtoId } = req.params;
  
  try {
    const produtoFavorito = await prisma.produtoFavorito.findFirst({
      where: {
        userId: userId,
        produtoId: produtoId,
      },
    });

    if (produtoFavorito) {
      return res.status(200).json({ favorito: true });
    }

    return res.status(200).json({ favorito: false });
  } catch (error) {
    console.error('Erro ao verificar favorito:', error);
    return res.status(500).json({ message: 'Erro ao verificar favorito.' });
  }
});

// Rota para remover o produto dos favoritos
app.delete('/remover-favorito/:userId/:produtoId', async (req, res) => {
  const { userId, produtoId } = req.params;
  
  try {
    await prisma.produtoFavorito.deleteMany({
      where: {
        userId: userId,
        produtoId: produtoId,
      },
    });

    return res.status(200).json({ message: 'Produto removido dos favoritos.' });
  } catch (error) {
    console.error('Erro ao remover produto dos favoritos:', error);
    return res.status(500).json({ message: 'Erro ao remover produto dos favoritos.' });
  }
});


app.get('/favoritos/usuario/:id', async (req, res) => {
  const { id } = req.params; // Obtém o ID do usuário a partir dos parâmetros da URL

  try {
    // Consultando os produtos favoritos do usuário
    const favoritos = await prisma.produtoFavorito.findMany({
      where: {
        userId: id, // Filtra pelos favoritos do usuário específico
      },
      include: {
        produto: {
          include: {
            lojista: { // Inclui os dados do lojista relacionado ao produto
              select: {
                nomeEmpresa: true,    // Nome da empresa
                imagemLojista: true,  // Imagem do lojista
              },
            },
          },
        },
      },
    });

    // Retorna os produtos favoritos com os dados do lojista
    res.json(
      favoritos.map(fav => ({
        ...fav.produto,
        lojista: fav.produto.lojista,
      }))
    );
  } catch (error) {
    console.error('Erro ao buscar produtos favoritos:', error.message);
    res.status(500).json({ error: 'Erro ao buscar produtos favoritos' });
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
