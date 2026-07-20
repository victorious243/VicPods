(function initStudioCommandCenter() {
  function parseSearchItems(root) {
    var script = root.querySelector('[data-studio-search-data]');
    if (!script) {
      return [];
    }

    try {
      return JSON.parse(script.textContent || '[]');
    } catch (error) {
      return [];
    }
  }

  function renderSearchResults(container, items) {
    if (!items.length) {
      container.innerHTML = '<p class="empty-state">No Studio results found.</p>';
      container.hidden = false;
      return;
    }

    container.innerHTML = items.map(function mapItem(item) {
      return [
        '<a class="studio-search-result" href="', escapeHtml(item.href), '">',
        '<span class="studio-search-type">', escapeHtml(item.type), '</span>',
        '<span class="studio-search-copy">',
        '<strong>', escapeHtml(item.title), '</strong>',
        '<small>', escapeHtml(item.meta), '</small>',
        '<em>', escapeHtml(item.body), '</em>',
        '</span>',
        '</a>',
      ].join('');
    }).join('');
    container.hidden = false;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  document.querySelectorAll('[data-studio-search]').forEach(function setupSearch(root) {
    var input = root.querySelector('[data-studio-search-input]');
    var results = root.querySelector('[data-studio-search-results]');
    var items = parseSearchItems(root);

    if (!input || !results) {
      return;
    }

    input.addEventListener('input', function handleInput(event) {
      var query = String(event.target.value || '').trim().toLowerCase();

      if (query.length < 2) {
        results.hidden = true;
        results.innerHTML = '';
        return;
      }

      var matches = items
        .filter(function filterItem(item) {
          return String(item.searchText || '').indexOf(query) !== -1;
        })
        .slice(0, 8);

      renderSearchResults(results, matches);
    });

    input.addEventListener('keydown', function handleKeydown(event) {
      if (event.key === 'Escape') {
        input.value = '';
        results.hidden = true;
        results.innerHTML = '';
      }
    });
  });

  document.querySelectorAll('[data-studio-tabs]').forEach(function setupTabs(root) {
    var buttons = Array.from(root.querySelectorAll('[data-studio-tab]'));
    var panels = Array.from(root.querySelectorAll('[data-studio-tab-panel]'));

    buttons.forEach(function bindButton(button) {
      button.addEventListener('click', function handleClick() {
        var target = button.getAttribute('data-studio-tab');

        buttons.forEach(function updateButton(item) {
          var isActive = item === button;
          item.classList.toggle('is-active', isActive);
          item.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        panels.forEach(function updatePanel(panel) {
          var isActive = panel.getAttribute('data-studio-tab-panel') === target;
          panel.classList.toggle('is-active', isActive);
          panel.hidden = !isActive;
        });
      });
    });
  });
}());
