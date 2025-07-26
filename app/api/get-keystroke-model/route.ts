/// <reference types="node" />
// @ts-ignore
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  // TODO: Add authentication for production use
  const modelPath = path.join(process.cwd(), 'models', 'yas', 'model.json');
  if (!fs.existsSync(modelPath)) {
    return NextResponse.json({ error: 'Model not found' }, { status: 404 });
  }
  const modelJson = fs.readFileSync(modelPath, 'utf-8');
  return new Response(modelJson, {
    headers: { 'Content-Type': 'application/json' }
  });
} 