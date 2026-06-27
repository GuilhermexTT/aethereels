'use client';

import React, { useState, useEffect } from 'react';
import { useDashboard } from '@/context/DashboardContext';
import { 
  X, 
  Crown, 
  Check, 
  Zap, 
  Copy, 
  CheckCircle, 
  Loader2, 
  AlertTriangle,
  QrCode,
  ArrowRight
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function UpgradeModal() {
  const { isUpgradeModalOpen, setIsUpgradeModalOpen, refreshCredits } = useDashboard();
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'pro' | 'recharge'>('starter');
  const [loading, setLoading] = useState(false);
  const [checkoutData, setCheckoutData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [simulationSuccess, setSimulationSuccess] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Carregar usuário logado
  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    }
    loadUser();
  }, [isUpgradeModalOpen]);

  if (!isUpgradeModalOpen) return null;

  const handleCheckout = async () => {
    setLoading(true);
    setCheckoutData(null);
    setSimulationSuccess(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const response = await fetch('/api/payment/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          plan: selectedPlan,
          billingType: 'PIX',
          userId: userId // Passar userId logado como fallback seguro para dev
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao processar checkout');
      }

      const data = await response.json();
      setCheckoutData(data);
    } catch (err: any) {
      alert(err.message || 'Falha ao conectar com o gateway Asaas.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (checkoutData?.pixCode) {
      navigator.clipboard.writeText(checkoutData.pixCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSimulatePayment = async () => {
    const finalUserId = userId || checkoutData?.userId;
    if (!checkoutData || !finalUserId) {
      console.warn('Simulação cancelada: dados da cobrança ou do usuário ausentes.', { checkoutData, userId });
      return;
    }
    setSimulationLoading(true);
    try {
      const response = await fetch('/api/payment/simulate-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentId: checkoutData.paymentId,
          userId: finalUserId,
          value: checkoutData.value,
          credits: checkoutData.credits
        })
      });

      if (response.ok) {
        setSimulationSuccess(true);
        // Atualiza os créditos no cabeçalho/contexto global
        await refreshCredits();
      } else {
        alert('Falha ao simular recebimento.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao processar simulação.');
    } finally {
      setSimulationLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in select-none">
      <div 
        className="fixed inset-0 cursor-default"
        onClick={() => setIsUpgradeModalOpen(false)}
      />
      
      <div className="relative w-full max-w-4xl bg-[#050914] border border-[#15233c] rounded-3xl overflow-hidden shadow-2xl z-10 flex flex-col md:flex-row max-h-[90vh] md:max-h-[85vh]">
        {/* Close Button */}
        <button 
          onClick={() => setIsUpgradeModalOpen(false)}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 hover:bg-[#0d1426] rounded-xl transition-all cursor-pointer z-20"
          aria-label="Fechar modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Left Side: Plans Selection */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto border-r border-[#15233c]/60 flex flex-col gap-6">
          <div>
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-[10px] text-indigo-400 font-bold uppercase tracking-wider">
              <Crown className="h-3 w-3" /> Monetização Fase 2
            </div>
            <h2 className="text-2xl font-extrabold text-white mt-2">Escolha seu Plano</h2>
            <p className="text-xs text-slate-400 mt-1">Obtenha créditos adicionais para gerar vídeos HD instantaneamente.</p>
          </div>

          {/* Pricing Grid */}
          <div className="flex flex-col gap-3">
            {/* Plan: Starter */}
            <button
              onClick={() => setSelectedPlan('starter')}
              className={`flex items-center justify-between p-4 rounded-2xl border text-left transition-all duration-300 relative overflow-hidden group cursor-pointer ${
                selectedPlan === 'starter'
                  ? 'bg-[#0f172a] border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                  : 'bg-[#070c17]/50 border-[#15233c] hover:bg-[#0c1426]/50 hover:border-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl transition-colors ${
                  selectedPlan === 'starter' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-900 text-slate-400 group-hover:text-slate-200'
                }`}>
                  <Zap className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-1.5">
                    Starter
                    {selectedPlan === 'starter' && <Check className="h-3.5 w-3.5 text-blue-400" />}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 font-medium">350 créditos/mês (35 vídeos)</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-extrabold text-white">R$ 39,90</div>
                <div className="text-[9px] text-slate-500 mt-0.5">mensal</div>
              </div>
            </button>

            {/* Plan: Pro */}
            <button
              onClick={() => setSelectedPlan('pro')}
              className={`flex items-center justify-between p-4 rounded-2xl border text-left transition-all duration-300 relative overflow-hidden group cursor-pointer ${
                selectedPlan === 'pro'
                  ? 'bg-[#18112d] border-[#8b5cf6]/50 shadow-[0_0_15px_rgba(139,92,246,0.1)]'
                  : 'bg-[#070c17]/50 border-[#15233c] hover:bg-[#0c1426]/50 hover:border-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl transition-colors ${
                  selectedPlan === 'pro' ? 'bg-[#8b5cf6]/20 text-[#a78bfa]' : 'bg-slate-900 text-slate-400 group-hover:text-slate-200'
                }`}>
                  <Crown className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-1.5">
                    Pro
                    {selectedPlan === 'pro' && <Check className="h-3.5 w-3.5 text-[#a78bfa]" />}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 font-medium">900 créditos/mês (90 vídeos)</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-extrabold text-white">R$ 79,90</div>
                <div className="text-[9px] text-slate-500 mt-0.5">mensal</div>
              </div>
            </button>

            {/* Plan: Recharge */}
            <button
              onClick={() => setSelectedPlan('recharge')}
              className={`flex items-center justify-between p-4 rounded-2xl border text-left transition-all duration-300 relative overflow-hidden group cursor-pointer ${
                selectedPlan === 'recharge'
                  ? 'bg-[#0d1c25] border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                  : 'bg-[#070c17]/50 border-[#15233c] hover:bg-[#0c1426]/50 hover:border-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl transition-colors ${
                  selectedPlan === 'recharge' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-900 text-slate-400 group-hover:text-slate-200'
                }`}>
                  <Zap className="h-4.5 w-4.5 text-cyan-400" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-1.5">
                    Recarga Avulsa
                    {selectedPlan === 'recharge' && <Check className="h-3.5 w-3.5 text-cyan-400" />}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 font-medium">+150 créditos avulsos (15 vídeos)</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-extrabold text-white">R$ 19,90</div>
                <div className="text-[9px] text-slate-500 mt-0.5">sem recorrência</div>
              </div>
            </button>
          </div>

          {/* Info rule card */}
          <div className="p-4 bg-[#0a1122]/60 border border-[#1e2d4a]/50 rounded-2xl">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4.5 w-4.5 text-blue-400 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed text-slate-400">
                <strong className="text-slate-200 font-bold">Regra de Tokens Aprimorada:</strong> 1 vídeo HD finalizado e renderizado com sucesso consome rigorosamente <strong className="text-blue-400 font-bold">10 créditos</strong>. Se a geração falhar, nenhum crédito é cobrado. A criação de rascunhos e chats com consultor são <strong className="text-emerald-400">100% gratuitos</strong>.
              </div>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 hover:opacity-95 text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-500/10 transition-all active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando Faturamento Asaas...
              </>
            ) : (
              <>
                Confirmar e Pagar via Pix <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>

        {/* Right Side: Payment Details (Pix QR Code) */}
        <div className="flex-1 p-6 md:p-8 bg-[#04070f] flex flex-col justify-center items-center overflow-y-auto">
          {!checkoutData ? (
            <div className="flex flex-col items-center justify-center text-center p-6 gap-3 text-slate-500 select-none">
              <QrCode className="h-14 w-14 text-slate-700 animate-pulse" />
              <div>
                <h3 className="text-sm font-bold text-slate-300">Pagamento Pix Pendente</h3>
                <p className="text-[11px] text-slate-500 mt-1 max-w-xs leading-relaxed">Selecione o plano desejado ao lado e clique em pagar para gerar o QR code Pix do Asaas Sandbox.</p>
              </div>
            </div>
          ) : (
            <div className="w-full flex flex-col gap-6 items-center">
              <div className="text-center">
                <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400">QR Code Pix do Asaas Gerado</span>
                <h3 className="text-lg font-bold text-white mt-1">Escaneie para Pagar</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Identificador da Cobrança: {checkoutData.paymentId}</p>
              </div>

              {/* QR Code Container */}
              <div className="p-3 bg-white rounded-2xl shadow-lg shadow-black/40">
                <img 
                  src={checkoutData.pixQrCode} 
                  alt="Pix QR Code" 
                  className="h-40 w-40 object-contain select-none" 
                  draggable={false}
                />
              </div>

              {/* Pix copy paste */}
              <div className="w-full flex flex-col gap-2">
                <label className="text-[10px] text-slate-500 font-bold">Código Pix Copia e Cola:</label>
                <div className="flex items-center gap-2 bg-[#080d19] border border-[#16233d] rounded-xl p-2 max-w-full">
                  <span className="text-[9px] text-slate-400 truncate flex-1 font-mono">{checkoutData.pixCode}</span>
                  <button 
                    onClick={handleCopy}
                    className="p-1.5 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Copiar Pix"
                  >
                    {copied ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Asaas Sandbox Simulator */}
              <div className="w-full p-4.5 bg-blue-950/20 border border-blue-500/20 rounded-2xl flex flex-col gap-3.5 mt-2">
                <div className="flex items-start gap-2.5">
                  <Zap className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                  <div className="text-left">
                    <h4 className="text-[11px] font-bold text-white">Ambiente Sandbox (Homologação)</h4>
                    <p className="text-[9px] text-slate-400 leading-normal mt-0.5">Use o botão abaixo para simular o recebimento do pagamento Pix e acionar a rota do webhook do Asaas.</p>
                  </div>
                </div>

                {simulationSuccess ? (
                  <div className="flex items-center gap-2 p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl justify-center text-center">
                    <CheckCircle className="h-4.5 w-4.5" />
                    <span className="text-[10px] font-bold">Pagamento Simulado! Créditos Adicionados!</span>
                  </div>
                ) : (
                  <button
                    onClick={handleSimulatePayment}
                    disabled={simulationLoading}
                    className="w-full py-2.5 rounded-xl bg-blue-600/20 border border-blue-500/50 hover:bg-blue-600/30 text-[10px] font-bold text-blue-300 flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {simulationLoading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Disparando Webhook...
                      </>
                    ) : (
                      <>
                        <Zap className="h-3.5 w-3.5 text-blue-400" />
                        Simular Pagamento no Sandbox
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
