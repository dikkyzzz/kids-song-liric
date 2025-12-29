const OpenAI = require('openai');

// Initialize Groq client (OpenAI-compatible API)
const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1'
});

// Llama model to use (current active model)
const MODEL = 'llama-3.3-70b-versatile';

/**
 * Generate a list of song titles based on a theme
 * @param {string} theme - The theme of the songs
 * @param {number} count - Number of titles to generate
 * @returns {Promise<string[]>}
 */
async function generateSongTitles(theme, count) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY tidak ditemukan di file .env. Dapatkan gratis di https://console.groq.com');
  }

  console.log(`[Groq] Generating ${count} song titles with theme: ${theme}`);

  const prompt = `Buatkan ${count} judul lagu anak-anak yang kreatif dan menarik dengan tema "${theme}".

Ketentuan:
1. Judul harus dalam Bahasa Indonesia
2. Judul harus unik, kreatif, dan cocok untuk anak-anak
3. Judul harus bervariasi dan tidak mirip satu sama lain
4. Setiap judul harus berhubungan dengan tema "${theme}"

Format output (HARUS PERSIS seperti ini, satu judul per baris, tanpa nomor):
Judul Lagu 1
Judul Lagu 2
Judul Lagu 3
...dst`;

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: 'Kamu adalah penulis lagu anak-anak Indonesia yang kreatif. Berikan hanya daftar judul, tanpa penjelasan tambahan.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.9
    });

    const text = response.choices[0].message.content;
    const titles = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.match(/^\d+[\.\)]/)) // Remove empty lines and numbered prefixes
      .map(line => line.replace(/^[-•*]\s*/, '').trim()) // Remove bullet points
      .slice(0, count);

    console.log(`[Groq] Generated ${titles.length} titles`);
    return titles;
  } catch (error) {
    console.error('[Groq] Error generating titles:', error.message);
    throw new Error(`Groq API Error: ${error.message}`);
  }
}

/**
 * Generate song lyrics for a specific title
 * @param {string} title - The song title
 * @param {string} theme - The theme of the song
 * @returns {Promise<string>}
 */
async function generateLyricsForTitle(title, theme) {
  console.log(`[Groq] Generating lyrics for: ${title}`);

  const exampleFormat = `Hujan Gerimis

Verse 1:
Hujan gerimis turun pelan,
Tetesnya dingin, bikin senang.
Ku pakai jas hujan warna cerah,
Siap main di luar, tak takut basah!

Chorus:
Hujan gerimis, hujan gerimis,
Langit kelabu tapi hati ceria.
Lompat-lompat di genangan air,
Bersama teman, riang tak terkira!

Verse 2:
Udara segar, daun berkilau,
Cacing keluar dari sarangnya.
Kata Ibu, "Jangan lupa jaket!"
Agar sehat, tak kena flu nanti.

Chorus:
Hujan gerimis, hujan gerimis,
Langit kelabu tapi hati ceria.
Lompat-lompat di genangan air,
Bersama teman, riang tak terkira!

Outro:
Hujan gerimis… perlahan reda,
Muncul pelangi—indah berseri!`;

  const prompt = `Buatkan lirik lagu anak-anak dengan judul "${title}" yang berhubungan dengan tema "${theme}".

Ketentuan:
1. Lagu dalam Bahasa Indonesia yang sederhana dan mudah dipahami anak-anak
2. Gunakan struktur: Verse 1, Chorus, Verse 2, Chorus, dan Outro
3. Setiap Verse terdiri dari 4 baris
4. Chorus terdiri dari 4 baris dan diulang
5. Outro terdiri dari 2 baris
6. Gunakan rima yang menyenangkan dan mudah diingat
7. Lirik harus positif, edukatif, dan menyenangkan

CONTOH FORMAT YANG BENAR:
${exampleFormat}

Sekarang buatkan lirik untuk lagu "${title}":`;

  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount <= maxRetries) {
    try {
      const response = await client.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: 'Kamu adalah penulis lagu anak-anak Indonesia yang berbakat. Buatlah lirik yang simpel, ceria, dan mudah dinyanyikan anak-anak. JANGAN tambahkan penjelasan apapun, langsung tulis liriknya saja.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      });

      const lyrics = response.choices[0].message.content.trim();
      console.log(`[Groq] Lyrics generated for: ${title}`);
      return lyrics;
    } catch (error) {
      console.error(`[Groq] Error generating lyrics:`, error.message);

      if (error.status === 429 && retryCount < maxRetries) {
        const retryDelay = Math.pow(2, retryCount + 1) * 2000;
        console.log(`[Groq] Rate limited. Waiting ${retryDelay / 1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryCount++;
        continue;
      }

      throw new Error(`Groq API Error: ${error.message}`);
    }
  }

  throw new Error('Gagal generate setelah beberapa percobaan.');
}

/**
 * Generate song lyrics for a kids song (wrapper for backward compatibility)
 * @param {string} theme - The theme of the song
 * @param {number} songNumber - The song number in the batch
 * @returns {Promise<{title: string, lyrics: string}>}
 */
async function generateSongLyrics(theme, songNumber) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY tidak ditemukan di file .env. Dapatkan gratis di https://console.groq.com');
  }

  // Generate a single title first
  const titles = await generateSongTitles(theme, 1);
  const title = titles[0] || `Lagu ${theme} ${songNumber}`;

  // Then generate lyrics for that title
  const lyrics = await generateLyricsForTitle(title, theme);

  return { title, lyrics };
}

/**
 * Generate multiple songs: first all titles, then lyrics for each
 * @param {string} theme - The theme of songs
 * @param {number} count - Number of songs to generate
 * @param {function} onProgress - Callback for progress updates
 * @returns {Promise<Array<{title: string, lyrics: string}>>}
 */
async function generateBatchSongs(theme, count, onProgress) {
  const songs = [];

  // Step 1: Generate all titles first
  if (onProgress) {
    onProgress({
      status: 'generating_titles',
      message: `Generating ${count} judul lagu...`
    });
  }

  let titles;
  try {
    titles = await generateSongTitles(theme, count);
  } catch (error) {
    console.error('Error generating titles:', error.message);
    // Fallback to generic titles
    titles = Array.from({ length: count }, (_, i) => `Lagu ${theme} ${i + 1}`);
  }

  if (onProgress) {
    onProgress({
      status: 'titles_generated',
      message: `✓ ${titles.length} judul berhasil dibuat`,
      titles: titles
    });
  }

  // Small delay before generating lyrics
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Step 2: Generate lyrics for each title
  for (let i = 0; i < titles.length; i++) {
    const title = titles[i];
    const songNumber = i + 1;

    try {
      if (onProgress) {
        onProgress({
          current: songNumber,
          total: count,
          status: 'generating_lyrics',
          message: `Membuat lirik untuk "${title}"...`
        });
      }

      const lyrics = await generateLyricsForTitle(title, theme);

      songs.push({ title, lyrics });

      if (onProgress) {
        onProgress({
          current: songNumber,
          total: count,
          status: 'song_complete',
          message: `✓ Lagu ${songNumber}: "${title}"`,
          song: { title, lyrics }
        });
      }

      // Add small delay between songs (1 second)
      if (i < titles.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Error generating song ${songNumber}:`, error.message);
      songs.push({
        title: title,
        lyrics: `Terjadi kesalahan saat generate lirik: ${error.message}`
      });

      if (onProgress) {
        onProgress({
          current: songNumber,
          total: count,
          status: 'song_error',
          message: `✗ Error pada "${title}": ${error.message}`
        });
      }
    }
  }

  return songs;
}

module.exports = {
  generateSongTitles,
  generateLyricsForTitle,
  generateSongLyrics,
  generateBatchSongs
};
