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
  notice,
  onRefresh,
  onSelectModel,
}) {
  const selectedModel = models.find((model) => model.id === activeModel);
  const detailText = error
    || notice
    || (selectedModel ? formatModelMeta(selectedModel) || selectedModel.id : 'Pronto para conversar');

  return (
    <section className="model-section" aria-label="Modelo do LM Studio">
      <div className="section-title">
        <Cpu size={17} />
        <span>Modelo</span>
      </div>

      <label className="model-select-wrap">
        <select
          value={activeModel || ''}
          onChange={(event) => onSelectModel(event.target.value)}
          disabled={disabled || isLoading || models.length === 0}
          aria-label="Selecionar modelo"
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
        <button
          className="model-refresh"
          type="button"
          onClick={onRefresh}
          disabled={disabled || isLoading}
          title="Atualizar modelos"
          aria-label="Atualizar modelos"
        >
          {isLoading ? <Loader2 size={17} className="spin" /> : <RefreshCcw size={17} />}
        </button>
      </label>

      <div className={`model-state ${error ? 'error' : 'ok'}`}>
        {error ? <TriangleAlert size={15} /> : <CheckCircle2 size={15} />}
        <span>{detailText}</span>
      </div>
    </section>
  );
}

export default ModelSelector;
