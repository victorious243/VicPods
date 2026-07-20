(function initEpisodeTools() {
  function getSourceValue(key) {
    var source = document.querySelector('[data-copy-source="' + key + '"]');
    if (!source) {
      return '';
    }

    if (typeof source.value === 'string') {
      return source.value;
    }

    return source.textContent || '';
  }

  function setTemporaryLabel(button, nextLabel) {
    var defaultLabel = button.getAttribute('data-copy-label') || button.textContent;
    button.textContent = nextLabel;
    window.setTimeout(function resetLabel() {
      button.textContent = defaultLabel;
    }, 1800);
  }

  function notifyCopyCompleted(button) {
    var endpoint = button.getAttribute('data-copy-complete-endpoint');
    if (!endpoint) {
      return;
    }

    fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      credentials: 'same-origin',
    }).catch(function noop() {});
  }

  function fallbackCopy(text) {
    var helper = document.createElement('textarea');
    helper.value = text;
    helper.setAttribute('readonly', 'readonly');
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    helper.style.pointerEvents = 'none';
    document.body.appendChild(helper);
    helper.focus();
    helper.select();
    document.execCommand('copy');
    document.body.removeChild(helper);
  }

  function initCopyTriggers() {
    var triggers = document.querySelectorAll('[data-copy-trigger]');

    triggers.forEach(function bindCopyTrigger(button) {
      button.addEventListener('click', function handleCopy() {
        var key = button.getAttribute('data-copy-trigger');
        var text = getSourceValue(key).trim();

        if (!text) {
          setTemporaryLabel(button, 'Nothing to copy');
          return;
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text)
            .then(function onCopied() {
              notifyCopyCompleted(button);
              setTemporaryLabel(button, 'Copied');
            })
            .catch(function onClipboardError() {
              fallbackCopy(text);
              notifyCopyCompleted(button);
              setTemporaryLabel(button, 'Copied');
            });
          return;
        }

        fallbackCopy(text);
        notifyCopyCompleted(button);
        setTemporaryLabel(button, 'Copied');
      });
    });
  }

  function formatByteSize(byteSize) {
    var bytes = Number(byteSize || 0);
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return '';
    }

    if (bytes >= 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    return Math.round(bytes / 1024) + ' KB';
  }

  function formatDuration(durationSeconds) {
    var totalSeconds = Number(durationSeconds || 0);
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
      return '';
    }

    var roundedSeconds = Math.round(totalSeconds);
    var minutes = Math.floor(roundedSeconds / 60);
    var seconds = roundedSeconds % 60;

    return minutes + 'm ' + String(seconds).padStart(2, '0') + 's';
  }

  function setAudioStatus(root, text, isError) {
    var statusNode = root.querySelector('[data-audio-status]');
    if (!statusNode) {
      return;
    }

    statusNode.textContent = text;
    statusNode.classList.toggle('is-error', Boolean(isError));
  }

  function readFileAsDataUrl(file) {
    return new Promise(function resolveFile(resolve, reject) {
      var reader = new FileReader();

      reader.onload = function handleLoad(event) {
        resolve(event.target && event.target.result ? String(event.target.result) : '');
      };

      reader.onerror = function handleError() {
        reject(new Error('Could not read the MP3 file.'));
      };

      reader.readAsDataURL(file);
    });
  }

  function getAudioMetadata(file) {
    return new Promise(function resolveMetadata(resolve) {
      var objectUrl = window.URL.createObjectURL(file);
      var probe = document.createElement('audio');

      probe.preload = 'metadata';
      probe.onloadedmetadata = function handleLoadedMetadata() {
        var durationSeconds = Number.isFinite(probe.duration) ? Math.round(probe.duration) : null;
        window.URL.revokeObjectURL(objectUrl);
        resolve({
          durationSeconds: durationSeconds,
          bitrateKbps: durationSeconds
            ? Math.round((file.size * 8) / (durationSeconds * 1000))
            : null,
        });
      };
      probe.onerror = function handleMetadataError() {
        window.URL.revokeObjectURL(objectUrl);
        resolve({
          durationSeconds: null,
          bitrateKbps: null,
        });
      };
      probe.src = objectUrl;
    });
  }

  function updateAudioCard(root, asset) {
    var emptyState = root.querySelector('[data-audio-empty]');
    var currentState = root.querySelector('[data-audio-current]');
    var filenameNode = root.querySelector('[data-audio-filename]');
    var sizeNode = root.querySelector('[data-audio-size]');
    var dividerNode = root.querySelector('[data-audio-divider]');
    var durationNode = root.querySelector('[data-audio-duration]');
    var audioPlayer = root.querySelector('[data-audio-player]');
    var uploadTrigger = root.querySelector('[data-audio-upload-trigger]');

    if (emptyState) {
      emptyState.hidden = true;
    }

    if (currentState) {
      currentState.hidden = false;
    }

    if (filenameNode) {
      filenameNode.textContent = asset.originalFilename || 'Uploaded MP3';
    }

    if (sizeNode) {
      sizeNode.textContent = formatByteSize(asset.byteSize);
    }

    if (dividerNode) {
      dividerNode.textContent = asset.durationSeconds ? ' · ' : '';
    }

    if (durationNode) {
      durationNode.textContent = formatDuration(asset.durationSeconds);
    }

    if (audioPlayer && asset.publicUrl) {
      audioPlayer.hidden = false;
      audioPlayer.src = asset.publicUrl;
      audioPlayer.load();
    }

    if (uploadTrigger) {
      uploadTrigger.textContent = 'Replace MP3';
    }
  }

  function initAudioUploads() {
    var widgets = document.querySelectorAll('[data-audio-upload]');

    widgets.forEach(function bindAudioUpload(root) {
      var fileInput = root.querySelector('[data-audio-file]');
      var uploadTrigger = root.querySelector('[data-audio-upload-trigger]');
      var uploadEndpoint = root.getAttribute('data-upload-endpoint');

      if (!fileInput || !uploadTrigger || !uploadEndpoint) {
        return;
      }

      uploadTrigger.addEventListener('click', function handleAudioUpload() {
        var file = fileInput.files && fileInput.files[0];
        var looksLikeMp3 = file && (/audio\/mpeg|audio\/mp3/i.test(file.type) || /\.mp3$/i.test(file.name));

        if (!file) {
          setAudioStatus(root, 'Choose an MP3 file first.', true);
          return;
        }

        if (!looksLikeMp3) {
          setAudioStatus(root, 'Only MP3 uploads are supported right now.', true);
          return;
        }

        uploadTrigger.disabled = true;
        uploadTrigger.setAttribute('aria-busy', 'true');
        setAudioStatus(root, 'Uploading MP3...', false);

        Promise.all([readFileAsDataUrl(file), getAudioMetadata(file)])
          .then(function handleFileResults(results) {
            var audioDataUrl = results[0];
            var metadata = results[1];

            return fetch(uploadEndpoint, {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
              },
              credentials: 'same-origin',
              body: JSON.stringify({
                originalFilename: file.name,
                mimeType: file.type || 'audio/mpeg',
                audioDataUrl: audioDataUrl,
                durationSeconds: metadata.durationSeconds,
                bitrateKbps: metadata.bitrateKbps,
              }),
            });
          })
          .then(function handleUploadResponse(response) {
            return response.json()
              .catch(function handleInvalidResponse() {
                return {};
              })
              .then(function resolvePayload(payload) {
                if (!response.ok) {
                  throw new Error(payload.error || 'Upload failed.');
                }

                return payload;
              });
          })
          .then(function handleUploadSuccess(payload) {
            if (payload && payload.asset) {
              updateAudioCard(root, payload.asset);
            }

            fileInput.value = '';
            setAudioStatus(root, 'MP3 uploaded. This episode is ready for the publish step.', false);
          })
          .catch(function handleUploadFailure(error) {
            setAudioStatus(root, error.message || 'Upload failed.', true);
          })
          .finally(function finishUpload() {
            uploadTrigger.disabled = false;
            uploadTrigger.removeAttribute('aria-busy');
          });
      });
    });
  }

  function setCoverStatus(root, text, isError) {
    var statusNode = root.querySelector('[data-cover-status]');
    if (!statusNode) {
      return;
    }

    statusNode.textContent = text;
    statusNode.classList.toggle('is-error', Boolean(isError));
  }

  function initCoverUploads() {
    var widgets = document.querySelectorAll('[data-cover-upload]');

    widgets.forEach(function bindCoverUpload(root) {
      var fileInput = root.querySelector('[data-cover-file]');
      var uploadTrigger = root.querySelector('[data-cover-upload-trigger]');
      var uploadEndpoint = root.getAttribute('data-cover-endpoint');
      var preview = root.querySelector('[data-cover-preview]');
      var emptyState = root.querySelector('[data-cover-empty]');

      if (!fileInput || !uploadTrigger || !uploadEndpoint) {
        return;
      }

      uploadTrigger.addEventListener('click', function handleCoverUpload() {
        var file = fileInput.files && fileInput.files[0];
        var looksLikeImage = file && (/image\/(png|jpe?g|webp)/i.test(file.type));

        if (!file) {
          setCoverStatus(root, 'Choose a cover image first.', true);
          return;
        }

        if (!looksLikeImage) {
          setCoverStatus(root, 'Cover artwork must be JPG, PNG, or WebP.', true);
          return;
        }

        uploadTrigger.disabled = true;
        uploadTrigger.setAttribute('aria-busy', 'true');
        setCoverStatus(root, 'Uploading cover artwork...', false);

        readFileAsDataUrl(file)
          .then(function handleCoverDataUrl(coverDataUrl) {
            return fetch(uploadEndpoint, {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
              },
              credentials: 'same-origin',
              body: JSON.stringify({
                coverDataUrl: coverDataUrl,
              }),
            });
          })
          .then(function handleCoverResponse(response) {
            return response.json()
              .catch(function handleInvalidResponse() {
                return {};
              })
              .then(function resolvePayload(payload) {
                if (!response.ok) {
                  throw new Error(payload.error || 'Cover upload failed.');
                }

                return payload;
              });
          })
          .then(function handleCoverSuccess(payload) {
            if (preview && payload.coverImageUrl) {
              preview.src = payload.coverImageUrl;
              preview.hidden = false;
            }

            if (emptyState) {
              emptyState.hidden = true;
            }

            fileInput.value = '';
            setCoverStatus(root, 'Cover artwork uploaded.', false);
          })
          .catch(function handleCoverFailure(error) {
            setCoverStatus(root, error.message || 'Cover upload failed.', true);
          })
          .finally(function finishCoverUpload() {
            uploadTrigger.disabled = false;
            uploadTrigger.removeAttribute('aria-busy');
          });
      });
    });
  }

  initCopyTriggers();
  initAudioUploads();
  initCoverUploads();
}());
