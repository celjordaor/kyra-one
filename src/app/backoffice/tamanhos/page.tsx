'use client'

import { useState, useEffect } from 'react'
import { Plus, Loader2, Pencil, Trash2, PowerOff, Check, X, Ruler } from 'lucide-react'
import { useUI } from '@/components/ui/UIProvider'

interface Tamanho { id: string; nome: string; ordem: number; ativo: boolean }

export default function TamanhosPage() {
  const { success, error, warning, confirm } = useUI()
  const [lista, setLista] = useState<Tamanho[]>([])
  const [loading, setLoading] = useState(true)
  const [novoNome, setNovoNome] = useState('')
  const [salvandoNovo, setSalvandoNovo] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')
  const [salvandoEdit, setSalvandoEdit] = useState(false)

  async function carregar() {
    setLoading(true)
    try {
      const res = await fetch('/api/tamanhos')
      const data = await res.json()
      if (Array.isArray(data)) setLista(data)
    } catch {
      error('Erro', 'Não foi possível carregar os tamanhos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [])

  async function handleAdicionar(e: React.FormEvent) {
    e.preventDefault()
    if (!novoNome.trim()) return
    setSalvandoNovo(true)
    try {
      const res = await fetch('/api/tamanhos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: novoNome.trim().toUpperCase(), ativo: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setNovoNome('')
      success('Tamanho adicionado', novoNome.trim().toUpperCase())
      await carregar()
    } catch (err: any) {
      error('Erro ao adicionar', err.message)
    } finally {
      setSalvandoNovo(false)
    }
  }

  async function handleEditar(t: Tamanho) {
    if (!editNome.trim()) { setEditandoId(null); return }
    if (editNome.trim().toUpperCase() === t.nome) { setEditandoId(null); return }
    setSalvandoEdit(true)
    try {
      const res = await fetch(`/api/tamanhos/${t.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: editNome.trim().toUpperCase() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      success('Tamanho atualizado', `${t.nome} → ${editNome.trim().toUpperCase()}`)
      setEditandoId(null)
      await carregar()
    } catch (err: any) {
      error('Erro ao editar', err.message)
    } finally {
      setSalvandoEdit(false)
    }
  }

  function iniciarEdicao(t: Tamanho) {
    setEditandoId(t.id)
    setEditNome(t.nome)
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setEditNome('')
  }

  async function handleToggleAtivo(t: Tamanho) {
    const acao = t.ativo ? 'Inativar' : 'Reativar'
    const ok = await confirm({
      title: `${acao} "${t.nome}"`,
      message: t.ativo
        ? 'O tamanho não aparecerá mais nos formulários e na loja virtual.'
        : 'O tamanho voltará a aparecer nos formulários e na loja virtual.',
      confirmLabel: acao,
      danger: t.ativo,
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/tamanhos/${t.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !t.ativo }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      success(t.ativo ? 'Tamanho inativado' : 'Tamanho reativado', t.nome)
      await carregar()
    } catch (err: any) {
      error('Erro', err.message)
    }
  }

  async function handleExcluir(t: Tamanho) {
    const ok = await confirm({
      title: `Excluir "${t.nome}"`,
      message: 'Se houver produtos com este tamanho, a exclusão será bloqueada. Prefira inativar.',
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/tamanhos/${t.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.status === 409 && data.bloqueado) {
        warning('Não é possível excluir', data.message)
        return
      }
      if (!res.ok) throw new Error(data.error)
      success('Tamanho excluído', t.nome)
      await carregar()
    } catch (err: any) {
      error('Erro ao excluir', err.message)
    }
  }

  async function moverOrdem(id: string, direcao: 'up' | 'down') {
    const idx = lista.findIndex(t => t.id === id)
    const outro = direcao === 'up' ? lista[idx - 1] : lista[idx + 1]
    if (!outro) return
    const atual = lista[idx]
    await Promise.all([
      fetch(`/api/tamanhos/${atual.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ordem: outro.ordem }) }),
      fetch(`/api/tamanhos/${outro.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ordem: atual.ordem }) }),
    ])
    await carregar()
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="h-14 border-b border-[#F2D0D8]/60 bg-white flex items-center justify-between px-6 sticky top-0 z-10">
        <h1 className="text-base font-semibold text-[#2D2D2D]">Tamanhos</h1>
        <span className="text-xs text-[#2D2D2D]/40">{lista.length} tamanho{lista.length !== 1 ? 's' : ''}</span>
      </div>

      <main className="flex-1 p-6 max-w-2xl space-y-5">

        {/* Adicionar novo */}
        <form onSubmit={handleAdicionar} className="flex gap-3">
          <input
            value={novoNome}
            onChange={e => setNovoNome(e.target.value)}
            placeholder="Ex: 7G, EXG, Plus..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-[#E8DDD9] bg-white text-sm text-[#2D2D2D] placeholder:text-[#2D2D2D]/30 focus:outline-none focus:ring-2 focus:ring-[#C97A8A]/30 focus:border-[#C97A8A] transition"
          />
          <button type="submit" disabled={salvandoNovo || !novoNome.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#C97A8A] hover:bg-[#b86878] text-white text-sm font-medium rounded-xl transition disabled:opacity-50">
            {salvandoNovo ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Adicionar
          </button>
        </form>

        {/* Info */}
        <div className="bg-[#F2D0D8]/20 rounded-xl px-4 py-3 text-xs text-[#2D2D2D]/60 leading-relaxed">
          Tamanhos ativos aparecem nos formulários de produto e nos filtros da loja.
          Clique no <strong>lápis</strong> para renomear, nas <strong>setas</strong> para reordenar.
          Inativar preserva os produtos existentes — exclua apenas tamanhos sem produtos vinculados.
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin text-[#C97A8A]" />
          </div>
        ) : lista.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#F2D0D8]/40 px-6 py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#F2D0D8]/50 flex items-center justify-center mx-auto mb-4">
              <Ruler size={24} className="text-[#C97A8A]" />
            </div>
            <p className="text-sm font-medium text-[#2D2D2D] mb-1">Nenhum tamanho cadastrado</p>
            <p className="text-xs text-[#2D2D2D]/40 mb-4">
              Execute o SQL de migration no Supabase para inserir os tamanhos padrão (PP ao 6G),
              ou adicione manualmente usando o campo acima.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#F2D0D8]/40 overflow-hidden">
            <div className="px-5 py-3 border-b border-[#F2D0D8]/40 grid grid-cols-12 gap-2">
              <p className="col-span-1 text-xs text-[#2D2D2D]/40 font-medium">Ord.</p>
              <p className="col-span-4 text-xs text-[#2D2D2D]/40 font-medium">Nome</p>
              <p className="col-span-3 text-xs text-[#2D2D2D]/40 font-medium">Status</p>
              <p className="col-span-4 text-xs text-[#2D2D2D]/40 font-medium text-right">Ações</p>
            </div>

            {lista.map((t, idx) => (
              <div key={t.id}
                className="px-5 py-3 border-b border-[#F2D0D8]/20 last:border-0 grid grid-cols-12 gap-2 items-center hover:bg-[#FAF7F5] transition">

                {/* Ordem */}
                <div className="col-span-1 flex flex-col gap-0.5">
                  <button onClick={() => moverOrdem(t.id, 'up')} disabled={idx === 0}
                    className="text-[#2D2D2D]/20 hover:text-[#C97A8A] disabled:opacity-0 transition text-[10px] leading-none">▲</button>
                  <button onClick={() => moverOrdem(t.id, 'down')} disabled={idx === lista.length - 1}
                    className="text-[#2D2D2D]/20 hover:text-[#C97A8A] disabled:opacity-0 transition text-[10px] leading-none">▼</button>
                </div>

                {/* Nome — modo edição ou exibição */}
                <div className="col-span-4">
                  {editandoId === t.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        value={editNome}
                        onChange={e => setEditNome(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleEditar(t)
                          if (e.key === 'Escape') cancelarEdicao()
                        }}
                        autoFocus
                        className="w-20 px-2 py-1 rounded-lg border border-[#C97A8A] text-sm font-semibold text-[#2D2D2D] focus:outline-none focus:ring-1 focus:ring-[#C97A8A]"
                      />
                      {salvandoEdit
                        ? <Loader2 size={13} className="animate-spin text-[#C97A8A]" />
                        : <>
                            <button onClick={() => handleEditar(t)} className="text-[#7FAF8A] hover:text-[#5a8f6a] transition"><Check size={14} /></button>
                            <button onClick={cancelarEdicao} className="text-[#2D2D2D]/30 hover:text-[#2D2D2D] transition"><X size={14} /></button>
                          </>
                      }
                    </div>
                  ) : (
                    <span className={`text-sm font-semibold ${t.ativo ? 'text-[#2D2D2D]' : 'text-[#2D2D2D]/30 line-through'}`}>
                      {t.nome}
                    </span>
                  )}
                </div>

                {/* Status */}
                <div className="col-span-3">
                  <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${
                    t.ativo ? 'bg-[#7FAF8A]/15 text-[#7FAF8A]' : 'bg-[#2D2D2D]/10 text-[#2D2D2D]/40'
                  }`}>
                    {t.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                {/* Ações */}
                <div className="col-span-4 flex items-center justify-end gap-1">
                  <button
                    onClick={() => iniciarEdicao(t)}
                    disabled={editandoId === t.id}
                    title="Renomear"
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-[#2D2D2D]/30 hover:text-[#C97A8A] hover:bg-[#F2D0D8]/30 transition disabled:opacity-30">
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleToggleAtivo(t)}
                    title={t.ativo ? 'Inativar' : 'Reativar'}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition ${
                      t.ativo
                        ? 'text-[#2D2D2D]/30 hover:text-[#E8A838] hover:bg-[#E8A838]/10'
                        : 'text-[#7FAF8A] hover:bg-[#7FAF8A]/10'
                    }`}>
                    <PowerOff size={13} />
                  </button>
                  <button
                    onClick={() => handleExcluir(t)}
                    title="Excluir"
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-[#2D2D2D]/30 hover:text-[#D95F5F] hover:bg-[#D95F5F]/10 transition">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
