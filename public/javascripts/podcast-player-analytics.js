(function initPodcastPlayerAnalytics() {
  var trackedPlayers = Array.prototype.slice.call(document.querySelectorAll('[data-podcast-player]'));

  function postPlayerEvent(audio, eventType) {
    var episodeId = audio.getAttribute('data-episode-id')
      || audio.closest('[data-podcast-player]')?.getAttribute('data-episode-id');

    if (!episodeId || !window.fetch) {
      return;
    }

    window.fetch('/api/podcast/player-events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        episodeId: episodeId,
        eventType: eventType,
        source: audio.getAttribute('data-podcast-player-source') || 'web_player',
        positionSeconds: Math.round(audio.currentTime || 0),
        durationSeconds: Math.round(audio.duration || 0),
      }),
    }).catch(function ignoreAnalyticsError() {});
  }

  trackedPlayers.forEach(function bindPlayer(player) {
    var audio = player.tagName === 'AUDIO' ? player : player.querySelector('audio');

    if (!audio) {
      return;
    }

    var playTracked = false;
    var completeTracked = false;

    audio.addEventListener('play', function onPlay() {
      if (playTracked) {
        return;
      }
      playTracked = true;
      postPlayerEvent(audio, 'player_play');
    });

    audio.addEventListener('ended', function onEnded() {
      if (completeTracked) {
        return;
      }
      completeTracked = true;
      postPlayerEvent(audio, 'player_complete');
    });
  });
}());
