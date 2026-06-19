import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { OpenAIEmbeddings } from '@langchain/openai';
import { OllamaEmbeddings } from '@langchain/ollama';
import type { AgentSettings } from './agent.js';

const _require = createRequire(import.meta.url);
let userDataDir = '';
try {
  userDataDir = _require('electron').app.getPath('userData');
} catch {
  userDataDir = path.resolve(process.cwd(), 'data');
}

// ============================================================
// 类型定义
// ============================================================

export interface KnowledgeDocument {
  id: string;
  name: string;
  filePath: string;
  addedAt: string;
  chunkCount: number;
}

export interface KnowledgeChunk {
  id: string;
  docId: string;
  docName: string;
  content: string;
  embedding: number[];
}

export interface SearchResult {
  chunkId: string;
  docName: string;
  content: string;
  score: number;
}

// ============================================================
// 知识库管理器
// ============================================================

class KnowledgeBaseManager {
  private documents: KnowledgeDocument[] = [];
  private chunks: KnowledgeChunk[] = [];
  private kbDir: string;
  private metaPath: string;
  private chunksPath: string;

  constructor() {
    this.kbDir = path.join(userDataDir, 'knowledge-base');
    this.metaPath = path.join(this.kbDir, 'documents.json');
    this.chunksPath = path.join(this.kbDir, 'chunks.json');
    this.load();
  }

  // --- 持久化 ---

  private load() {
    try {
      if (fs.existsSync(this.metaPath)) {
        this.documents = JSON.parse(fs.readFileSync(this.metaPath, 'utf-8'));
      }
      if (fs.existsSync(this.chunksPath)) {
        this.chunks = JSON.parse(fs.readFileSync(this.chunksPath, 'utf-8'));
      }
    } catch (e) {
      console.error('Failed to load knowledge base:', e);
      this.documents = [];
      this.chunks = [];
    }
  }

  private save() {
    if (!fs.existsSync(this.kbDir)) {
      fs.mkdirSync(this.kbDir, { recursive: true });
    }
    fs.writeFileSync(this.metaPath, JSON.stringify(this.documents, null, 2), 'utf-8');
    fs.writeFileSync(this.chunksPath, JSON.stringify(this.chunks, null, 2), 'utf-8');
  }

  // --- Embedding 生成 ---

  private createEmbeddings(settings: AgentSettings) {
    if (settings.provider === 'ollama') {
      return new OllamaEmbeddings({
        model: settings.model || 'llama3.1',
        baseUrl: settings.baseUrl || 'http://localhost:11434',
      });
    }
    const config: any = {
      model: 'text-embedding-3-small',
      apiKey: settings.apiKey || process.env.OPENAI_API_KEY,
    };
    if (settings.baseUrl) {
      config.configuration = { baseURL: settings.baseUrl };
    }
    return new OpenAIEmbeddings(config);
  }

  // --- 余弦相似度 ---

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  // --- 文件读取 ---

  private readFileContent(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const content = fs.readFileSync(filePath, 'utf-8');

    switch (ext) {
      case '.md':
      case '.txt':
      case '.csv':
      case '.json':
      case '.js':
      case '.ts':
      case '.py':
      case '.java':
      case '.go':
      case '.rs':
      case '.html':
      case '.css':
      case '.yaml':
      case '.yml':
      case '.xml':
      case '.log':
        return content;
      default:
        return content;
    }
  }

  // --- 添加文档 ---

  async addDocument(
    filePath: string,
    settings: AgentSettings
  ): Promise<KnowledgeDocument> {
    const name = path.basename(filePath);
    const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // 读取并切分文档
    const content = this.readFileContent(filePath);
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800,
      chunkOverlap: 200,
      separators: ['\n\n', '\n', '。', '.', '！', '!', '？', '?', ' ', ''],
    });
    const splits = await splitter.splitText(content);

    // 生成 embeddings
    const embeddings = this.createEmbeddings(settings);
    const vectors = await embeddings.embedDocuments(splits);

    // 创建 chunks
    const newChunks: KnowledgeChunk[] = splits.map((text, i) => ({
      id: `chunk-${id}-${i}`,
      docId: id,
      docName: name,
      content: text,
      embedding: vectors[i],
    }));

    const doc: KnowledgeDocument = {
      id,
      name,
      filePath,
      addedAt: new Date().toISOString(),
      chunkCount: newChunks.length,
    };

    this.documents.push(doc);
    this.chunks.push(...newChunks);
    this.save();

    return doc;
  }

  // --- 删除文档 ---

  removeDocument(docId: string): boolean {
    const idx = this.documents.findIndex((d) => d.id === docId);
    if (idx === -1) return false;

    this.documents.splice(idx, 1);
    this.chunks = this.chunks.filter((c) => c.docId !== docId);
    this.save();
    return true;
  }

  // --- 获取所有文档 ---

  getDocuments(): KnowledgeDocument[] {
    return [...this.documents];
  }

  // --- 语义搜索 ---

  async search(
    query: string,
    settings: AgentSettings,
    topK: number = 5
  ): Promise<SearchResult[]> {
    if (this.chunks.length === 0) return [];

    const embeddings = this.createEmbeddings(settings);
    const queryVector = await embeddings.embedQuery(query);

    const scored = this.chunks.map((chunk) => ({
      chunkId: chunk.id,
      docName: chunk.docName,
      content: chunk.content,
      score: this.cosineSimilarity(queryVector, chunk.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).filter((r) => r.score > 0.1);
  }

  // --- 获取知识库统计 ---

  getStats() {
    return {
      documentCount: this.documents.length,
      chunkCount: this.chunks.length,
    };
  }
}

// 导出单例
export const knowledgeBase = new KnowledgeBaseManager();
