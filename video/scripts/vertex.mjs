// Vertex AI 共通（課金は run-form-coach と同じ GCP プロジェクト。gcloud でログインしておく）
import { execFileSync } from 'node:child_process'
export const project = process.env.VERTEX_PROJECT || execFileSync('gcloud', ['config', 'get-value', 'project']).toString().trim()
export const token = () => execFileSync('gcloud', ['auth', 'print-access-token']).toString().trim()
export const endpoint = (loc, model, verb) => {
  const host = loc === 'global' ? 'aiplatform.googleapis.com' : `${loc}-aiplatform.googleapis.com`
  return `https://${host}/v1/projects/${project}/locations/${loc}/publishers/google/models/${model}:${verb}`
}
export async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`${url.split('/models/')[1]}: ${res.status} ${(await res.text()).slice(0, 300)}`)
  return res.json()
}
