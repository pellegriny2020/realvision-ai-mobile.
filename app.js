const API_BASE = 'https://realvision-api.tiagos-abreu.workers.dev';
const KEY = 'realvision_mobile_history';

const $ = id => document.getElementById(id);

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function load() {
  const list = getHistory();
  const area = $('historyList');

  if (!area) return;

  area.innerHTML = '';

  if (!list.length) {
    area.textContent = 'Seus vídeos aparecerão aqui.';
    return;
  }

  list.forEach(item => {
    const el = document.createElement('div');
    el.className = 'entry';

    const title = document.createElement('div');
    title.textContent = item.prompt || 'Vídeo sem título';
    el.appendChild(title);

    const small = document.createElement('small');
    small.textContent = (item.date || '') + ' • ' + (item.status || 'Em geração');
    el.appendChild(small);

    if (item.url) {
      const link = document.createElement('a');
      link.href = item.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Assistir vídeo';
      el.appendChild(link);
    }

    area.appendChild(el);
  });
}

function save(item) {
  const list = getHistory();
  const index = list.findIndex(x => x.id === item.id);

  if (index >= 0) {
    list[index] = item;
  } else {
    list.unshift(item);
  }

  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 30)));
  load();
}

function findStatus(data) {
  if (!data || typeof data !== 'object') return '';

  for (const [key, value] of Object.entries(data)) {
    if (
      /^(status|state|project_status|projectStatus)$/i.test(key) &&
      typeof value === 'string'
    ) {
      return value.toLowerCase();
    }
  }

  for (const value of Object.values(data)) {
    if (value && typeof value === 'object') {
      const status = findStatus(value);
      if (status) return status;
    }
  }

  return '';
}

function findVideoUrl(data, parentKey = '') {
  if (!data || typeof data !== 'object') {
    if (
      typeof data === 'string' &&
      /^https?:\/\//i.test(data) &&
      /(video|download|output|url|file|asset)/i.test(parentKey)
    ) {
      return data;
    }

    return null;
  }

  for (const [key, value] of Object.entries(data)) {
    const found = findVideoUrl(value, key);
    if (found) return found;
  }

  return null;
}

function isComplete(status) {
  return /^(complete|completed|success|succeeded|finished|done)$/i.test(status);
}

function isFailed(status) {
  return /^(failed|failure|error|cancelled|canceled)$/i.test(status);
}

function isProcessing(status) {
  return /^(pending|queued|processing|running|in_progress|in progress|generating)$/i.test(status);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

$('generate').onclick = async () => {
  const prompt = $('prompt').value.trim();
  const duration = Number($('duration').value);

  if (prompt.length < 8) {
    $('notice').textContent = 'Escreva uma descrição maior.';
    return;
  }

  if (!Number.isFinite(duration) || duration <= 0 || duration > 60) {
    $('notice').textContent =
      'Escolha uma duração válida de até 60 segundos.';
    return;
  }

  const button = $('generate');
  button.disabled = true;
  $('notice').textContent = 'Enviando pedido ao Magic Hour...';

  try {
    const response = await fetch(API_BASE + '/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: $('style').value + '. ' + prompt,
        duration,
        format: $('format').value,
        name: 'REALVISION AI'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || data.message || 'Erro no servidor: ' + response.status
      );
    }

    const id = data.id || data.project_id || data.data?.id;

    if (!id) {
      throw new Error(
        'O servidor não retornou o código do projeto. Verifique a resposta da API.'
      );
    }

    const item = {
      id,
      prompt,
      date: new Date().toLocaleString('pt-BR'),
      status: 'Em geração',
      url: ''
    };

    save(item);
    $('notice').textContent = 'Pedido enviado! Aguardando o vídeo...';

    for (let i = 0; i < 36; i++) {
      await wait(10000);

      const check = await fetch(
        API_BASE + '/status?id=' + encodeURIComponent(id)
      );

      const result = await check.json();

      if (!check.ok) {
        throw new Error(
          result.error || result.message ||
          'Não foi possível consultar o projeto: ' + check.status
        );
      }

      const status = findStatus(result);
      const videoUrl = findVideoUrl(result);

      if (isFailed(status)) {
        item.status = 'Falha na geração';
        save(item);

        throw new Error(
          result.message || result.error ||
          'A Magic Hour informou que a geração falhou.'
        );
      }

      if (isComplete(status) && videoUrl) {
        item.status = 'Concluído';
        item.url = videoUrl;
        save(item);

        const oldVideo = document.getElementById('generatedVideo');
        if (oldVideo) oldVideo.remove();

        const video = document.createElement('video');
        video.id = 'generatedVideo';
        video.controls = true;
        video.playsInline = true;
        video.src = videoUrl;
        video.style.width = '100%';

        $('notice').after(video);
        $('notice').textContent = 'Seu vídeo está pronto! 🎉';
        return;
      }

      if (isComplete(status) && !videoUrl) {
        item.status = 'Concluído — link não localizado';
        save(item);

        $('notice').textContent =
          'A API informou que o projeto terminou, mas não localizei o link do vídeo. Precisamos verificar a resposta do servidor.';
        return;
      }

      if (isProcessing(status) || !status) {
        $('notice').textContent =
          'Gerando vídeo... Aguarde. (' + (i + 1) + '/36)';
      } else {
        $('notice').textContent =
          'Status recebido: ' + status + '. Aguardando atualização...';
      }
    }

    $('notice').textContent =
      'O vídeo ainda não foi confirmado. Consulte o projeto na Magic Hour antes de solicitar outra geração.';
  } catch (error) {
    $('notice').textContent = 'Atenção: ' + error.message;
  } finally {
    button.disabled = false;
  }
};

$('clear').onclick = () => {
  if (confirm('Apagar o histórico deste aparelho?')) {
    localStorage.removeItem(KEY);
    load();
  }
};

let deferred;

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferred = event;

  if ($('install')) $('install').hidden = false;
});

$('install').onclick = async () => {
  if (!deferred) return;

  deferred.prompt();
  await deferred.userChoice;

  deferred = null;
  $('install').hidden = true;
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(error => {
      console.error('Falha ao registrar o service worker:', error);
    });
  });
}

load();
