(function initCreateUi() {
  function dispatchSyntheticEvent(element, eventName) {
    element.dispatchEvent(new Event(eventName, { bubbles: true }));
  }

  function setSelectValue(scope, name, value) {
    var field = scope.querySelector('[name="' + name + '"]');
    if (!field || typeof value === 'undefined' || value === null || value === '') {
      return;
    }

    field.value = String(value);
    dispatchSyntheticEvent(field, 'input');
    dispatchSyntheticEvent(field, 'change');
  }

  function setRadioValue(scope, name, value) {
    if (!value) {
      return;
    }

    var radios = scope.querySelectorAll('input[type="radio"][name="' + name + '"]');
    radios.forEach(function (radio) {
      radio.checked = radio.value === value;
      if (radio.checked) {
        dispatchSyntheticEvent(radio, 'input');
        dispatchSyntheticEvent(radio, 'change');
      }
    });
  }

  function setCheckboxValue(scope, name, checked) {
    var field = scope.querySelector('input[type="checkbox"][name="' + name + '"]');
    if (!field) {
      return;
    }

    field.checked = Boolean(checked);
    dispatchSyntheticEvent(field, 'input');
    dispatchSyntheticEvent(field, 'change');
  }

  function setInputValue(scope, name, value) {
    var field = scope.querySelector('[name="' + name + '"]');
    if (!field || typeof value === 'undefined' || value === null || value === '') {
      return;
    }

    field.value = String(value);
    dispatchSyntheticEvent(field, 'input');
    dispatchSyntheticEvent(field, 'change');
  }

  function parseJsonScript(id) {
    var node = document.getElementById(id);
    if (!node) {
      return null;
    }

    try {
      return JSON.parse(node.textContent || 'null');
    } catch (_error) {
      return null;
    }
  }

  function clearChildren(node) {
    while (node && node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function appendBadge(parent, label) {
    var badge = document.createElement('span');
    badge.className = 'mini-label';
    badge.textContent = label;
    parent.appendChild(badge);
  }

  function appendFlowChip(parent, label) {
    var chip = document.createElement('span');
    chip.className = 'podcast-style-flow-chip';
    chip.textContent = label;
    parent.appendChild(chip);
  }

  function bindPodcastTemplateSelection() {
    var root = document.querySelector('[data-podcast-template-root]');
    var templates = parseJsonScript('podcast-templates-data');

    if (!root || !Array.isArray(templates) || !templates.length) {
      return;
    }

    var form = root.closest('form') || document;
    var hiddenInput = root.querySelector('[data-template-type-input]');
    var templateCards = root.querySelectorAll('[data-template-key]');
    var selectedLabel = root.querySelector('[data-selected-template-label]');
    var selectedBestFor = root.querySelector('[data-selected-template-best-for]');
    var selectedDescription = root.querySelector('[data-selected-template-description]');
    var selectedPrompt = root.querySelector('[data-selected-template-prompt]');
    var selectedBadges = root.querySelector('[data-selected-template-badges]');
    var selectedSections = root.querySelector('[data-selected-template-sections]');
    var titleInput = form.querySelector('[data-template-title-input]');
    var descriptionInput = form.querySelector('[data-template-description-input]');
    var templateByKey = {};

    templates.forEach(function (template) {
      templateByKey[template.key] = template;
    });

    function syncSelectedCard(nextKey) {
      templateCards.forEach(function (card) {
        var isSelected = card.getAttribute('data-template-key') === nextKey;
        card.classList.toggle('is-selected', isSelected);
        card.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      });
    }

    function applyTemplate(key) {
      var template = templateByKey[key] || templates[0];
      if (!template) {
        return;
      }

      hiddenInput.value = template.key;
      syncSelectedCard(template.key);

      if (selectedLabel) {
        selectedLabel.textContent = template.label || '';
      }
      if (selectedBestFor) {
        selectedBestFor.textContent = template.bestFor || '';
      }
      if (selectedDescription) {
        selectedDescription.textContent = template.description || '';
      }
      if (selectedPrompt) {
        selectedPrompt.textContent = template.promptHint || '';
      }
      if (titleInput && template.exampleTitle) {
        titleInput.setAttribute('placeholder', template.exampleTitle);
      }
      if (descriptionInput && template.exampleDescription) {
        descriptionInput.setAttribute('placeholder', template.exampleDescription);
      }

      if (selectedBadges) {
        clearChildren(selectedBadges);
        [
          template.preview && template.preview.deliveryStyleLabel,
          template.preview && template.preview.hookStyleLabel,
          template.preview && template.preview.targetLengthLabel,
          template.preview && template.preview.ctaStyleLabel,
        ].filter(Boolean).forEach(function (label) {
          appendBadge(selectedBadges, label);
        });
      }

      if (selectedSections) {
        clearChildren(selectedSections);
        (template.sectionLabels || []).forEach(function (label) {
          appendFlowChip(selectedSections, label);
        });
      }

      setSelectValue(form, 'ctaStyle', template.showBlueprint && template.showBlueprint.ctaStyle);
      setRadioValue(form, 'tonePreset', template.tone && template.tone.tonePreset);
      setInputValue(form, 'toneIntensity', template.tone && template.tone.toneIntensity);
      setSelectValue(form, 'deliveryStyle', template.tone && template.tone.deliveryStyle);
      setSelectValue(form, 'episodeType', template.episodeStructure && template.episodeStructure.episodeType);
      setSelectValue(form, 'targetLength', template.episodeStructure && template.episodeStructure.targetLength);
      setCheckboxValue(form, 'includeFunSegment', template.episodeStructure && template.episodeStructure.includeFunSegment);
      setSelectValue(form, 'formatTemplate', template.episodeStructure && template.episodeStructure.formatTemplate);
      setSelectValue(form, 'hookStyle', template.episodeStructure && template.episodeStructure.hookStyle);
    }

    templateCards.forEach(function (card) {
      card.addEventListener('click', function () {
        applyTemplate(card.getAttribute('data-template-key'));
      });
    });

    applyTemplate((hiddenInput && hiddenInput.value) || templates[0].key);
  }

  var suggestButton = document.querySelector('[data-suggest-themes]');
  var themeTarget = document.querySelector('[data-theme-target]');
  var form = document.querySelector('#series-create-form');

  if (suggestButton && themeTarget && form) {
    suggestButton.addEventListener('click', function () {
      var payload = new URLSearchParams();
      var nameInput = form.querySelector('input[name="name"]');
      var goalInput = form.querySelector('input[name="goal"]');
      var intentInput = form.querySelector('select[name="intent"]');

      payload.set('name', nameInput ? nameInput.value : '');
      payload.set('goal', goalInput ? goalInput.value : '');
      payload.set('intent', intentInput ? intentInput.value : 'educate');

      fetch('/create/series/suggest-themes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payload.toString(),
      })
        .then(function (res) {
          if (!res.ok) {
            throw new Error('Unable to suggest themes right now.');
          }
          return res.json();
        })
        .then(function (data) {
          if (Array.isArray(data.suggestions) && data.suggestions.length) {
            themeTarget.value = data.suggestions.join('\n');
          }
        })
        .catch(function () {
          suggestButton.textContent = 'Suggestions unavailable';
        });
    });
  }

  bindPodcastTemplateSelection();
}());
