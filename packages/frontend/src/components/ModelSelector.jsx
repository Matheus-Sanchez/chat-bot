import { CheckCircle2, Cpu, Loader2, RefreshCcw, TriangleAlert } from 'lucide-react';

function formatModelMeta(model) {
  return [model.params, model.quantization].filter(Boolean).join(' - ');
}

function ModelSelector({
  activeModel,
  disabled,
  error,
  isLoading,
  models,
  onRefresh,
  onSelectModel,
}) {
  const selectedModel = models.find((model) => model.id === activeModel);

  return (
    <section className="model-panel" aria-label="Modelo do LM Studio">
      <div className="model-status">
        <span className={`status-dot ${error ? 'error' : 'ready'}`} />
        <div>
          <span className="status-label">{error ? 'LM Studio indisponivel' : 'LM Studio conectado'}</span>
          <strong title={selectedModel?.name || activeModel || 'Modelo automatico'}>
            {selectedModel?.name || activeModel || 'Modelo automatico'}
          </strong>
        </div>
      </div>

      <div className="model-controls">
        <label className="model-select-wrap" title="Modelo carregado para as proximas respostas">
          <Cpu size={16} aria-hidden="true" />
          <select
            value={activeModel || ''}
            onChange={(event) => onSelectModel(event.target.value)}
            disabled={disabled || isLoading || models.length === 0}
          >
            <option value="" disabled>
              Selecionar modelo
            </option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name} {formatModelMeta(model) ? `(${formatModelMeta(model)})` : ''}{model.loaded ? ' - carregado' : ''}
              </option>
            ))}
          </select>
        </label>

        <button
          className="icon-button"
          type="button"
          onClick={onRefresh}
          disabled={disabled || isLoading}
          title="Atualizar modelos"
          aria-label="Atualizar modelos"
        >
          {isLoading ? <Loader2 size={18} className="spin" /> : <RefreshCcw size={18} />}
        </button>
      </div>

      <div className={`model-note ${error ? 'error' : 'ok'}`}>
        {error ? <TriangleAlert size={15} /> : <CheckCircle2 size={15} />}
        <span>{error || (selectedModel ? formatModelMeta(selectedModel) || selectedModel.id : 'Pronto para responder')}</span>
      </div>
    </section>
  );
}

export default ModelSelector;
