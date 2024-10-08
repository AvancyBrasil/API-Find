import express from 'express'
import cors from 'cors'
import { PrismaClient } from '@prisma/client'
import multer from 'multer';
import path from 'path';
import fs from 'fs';

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
          ...(fotoPerfil && { fotoPerfil }) // Apenas atualize se fotoPerfil existir
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

//lojista

app.post('/lojistas', async (req, res) => {
    const { nome, sobrenome, cnpj, cpf, telefone, dataNasc, email, nomeEmpresa, senha } = req.body;

    try {
        const lojista = await prisma.lojista.create({
            data: {
                nome,
                sobrenome,
                cnpj,
                cpf,
                telefone,
                dataNasc,
                email,
                nomeEmpresa,
                senha,
            }
        });

        res.status(201).json(lojista);
    } catch (error) {
        console.error('Erro ao criar lojista:', error);
        res.status(500).json({ message: 'Erro no servidor. Tente novamente mais tarde.' });
    }
});

app.get('/lojistas', async (req, res) => {
    const { nome, email } = req.query;

    try {
        const lojistas = await prisma.lojista.findMany({
            where: {
                nome: nome,
                email: email
            }
        });
        res.status(200).json(lojistas);
    } catch (error) {
        console.error('Erro ao listar lojistas:', error);
        res.status(500).json({ message: 'Erro no servidor. Tente novamente mais tarde.' });
    }
});


app.put('/lojistas/:id', async (req, res) => {
    const { nome, sobrenome, cnpj, cep, logradouro,cidade, bairro, numEstab, complemento, numcontato, cpf, dataNasc, email, nomeEmpresa, senha } = req.body;

    try {
        const lojistaAtualizado = await prisma.lojista.update({
            where: {
                id: req.params.id
            },
            data: {
                nome,
                sobrenome,
                cnpj,
                cep,
                logradouro,
                cidade,
                bairro,
                numEstab,
                complemento,
                numcontato,
                cpf,
                dataNasc,
                email,
                nomeEmpresa,
                senha,
            }
        });

        res.status(200).json(lojistaAtualizado);
    } catch (error) {
        console.error('Erro ao atualizar lojista:', error);
        res.status(500).json({ message: 'Erro no servidor. Tente novamente mais tarde.' });
    }
});


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

    res.status(200).json(produtos);
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
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

    res.status(201).json(novoProduto);
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

    res.status(200).json(produtoAtualizado);
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

