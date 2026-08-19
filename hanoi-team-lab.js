(function () {
  const root = document.querySelector("[data-hanoi-lab]");

  if (!root) {
    return;
  }

  const pegNames = ["Start", "Bridge", "Finish"];
  const controls = {
    teamButtons: [...root.querySelectorAll("[data-hanoi-teams]")],
    diskSelect: root.querySelector("[data-hanoi-disks]"),
    minutesInput: root.querySelector("[data-hanoi-minutes]"),
    startButton: root.querySelector("[data-hanoi-start]"),
    resetButton: root.querySelector("[data-hanoi-reset]"),
    grid: root.querySelector("[data-hanoi-grid]"),
    winnerBanner: root.querySelector("[data-hanoi-winner]"),
    timeBanner: root.querySelector("[data-hanoi-time-up]")
  };

  const state = {
    diskCount: 4,
    teamCount: 2,
    timeLimitMinutes: 5,
    teamNames: ["Team Amber", "Team Teal"],
    teams: [],
    started: false,
    remainingMs: 5 * 60 * 1000,
    timeExpired: false,
    winner: null,
    deadline: 0,
    timerId: null
  };

  function makePegs(count) {
    return [Array.from({ length: count }, (_, index) => count - index), [], []];
  }

  function makeTeam(count) {
    return {
      pegs: makePegs(count),
      selected: null,
      selectedDisk: null,
      moves: 0,
      finishRemainingMs: null,
      message: "Ready for the challenge"
    };
  }

  function makeTeams() {
    state.teams = [makeTeam(state.diskCount), makeTeam(state.diskCount)];
  }

  function formatTime(milliseconds) {
    const totalTenths = Math.floor(milliseconds / 100);
    const minutes = Math.floor(totalTenths / 600);
    const seconds = Math.floor((totalTenths % 600) / 10);
    const tenths = totalTenths % 10;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
  }

  function optimalMoves() {
    return 2 ** state.diskCount - 1;
  }

  function setControlsDisabled(disabled) {
    controls.teamButtons.forEach((button) => {
      button.disabled = disabled;
    });

    if (controls.diskSelect) {
      controls.diskSelect.disabled = disabled;
    }

    if (controls.minutesInput) {
      controls.minutesInput.disabled = disabled;
    }
  }

  function stopTimer() {
    if (state.timerId) {
      window.clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function startTimer() {
    stopTimer();
    state.timerId = window.setInterval(() => {
      if (!state.started) {
        stopTimer();
        return;
      }

      const allFinished = state.teams
        .slice(0, state.teamCount)
        .every((team) => team.finishRemainingMs !== null);

      if (allFinished) {
        state.started = false;
        stopTimer();
        render();
        return;
      }

      state.remainingMs = Math.max(0, state.deadline - Date.now());

      if (state.remainingMs === 0) {
        state.started = false;
        state.timeExpired = true;
        state.teams = state.teams.map((team, index) => {
          if (index >= state.teamCount || team.finishRemainingMs !== null) {
            return team;
          }

          return {
            ...team,
            selected: null,
            selectedDisk: null,
            message: "Time is up"
          };
        });
        stopTimer();
        render();
        return;
      }

      updateTimerDisplays();
    }, 100);
  }

  function scrollGameIntoView() {
    if (!controls.grid || !window.matchMedia("(max-width: 940px)").matches) {
      return;
    }

    window.setTimeout(() => {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      controls.grid.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start"
      });
    }, 60);
  }

  function resetGame(nextDiskCount = state.diskCount, nextMinutes = state.timeLimitMinutes) {
    stopTimer();
    state.diskCount = nextDiskCount;
    state.timeLimitMinutes = nextMinutes;
    state.remainingMs = nextMinutes * 60 * 1000;
    state.started = false;
    state.timeExpired = false;
    state.winner = null;
    makeTeams();
    render();
  }

  function startChallenge() {
    const durationMs = state.timeLimitMinutes * 60 * 1000;
    state.remainingMs = durationMs;
    state.deadline = Date.now() + durationMs;
    state.started = true;
    state.timeExpired = false;
    state.winner = null;
    makeTeams();
    render();
    startTimer();
    scrollGameIntoView();
  }

  function selectPeg(teamIndex, pegIndex, requestedDisk) {
    const team = state.teams[teamIndex];

    if (!team || team.finishRemainingMs !== null) {
      return;
    }

    if (!state.started) {
      team.message = state.timeExpired ? "Time is up - start again" : "Start the challenge first";
      render();
      return;
    }

    if (team.selected === null) {
      const topDisk = team.pegs[pegIndex][team.pegs[pegIndex].length - 1];

      if (requestedDisk === undefined) {
        if (topDisk === undefined) {
          team.message = "This tower is empty";
          render();
          return;
        }
      }

      team.selected = pegIndex;
      team.selectedDisk = requestedDisk ?? topDisk;
      team.message = `Disk ${team.selectedDisk} selected on ${pegNames[pegIndex]}`;
      render();
      return;
    }

    if (team.selected === pegIndex) {
      if (requestedDisk !== undefined && requestedDisk === team.selectedDisk) {
        team.selected = null;
        team.selectedDisk = null;
        team.message = "Selection cleared";
      } else if (requestedDisk !== undefined) {
        team.selectedDisk = requestedDisk;
        team.message = `Disk ${requestedDisk} selected on ${pegNames[pegIndex]}`;
      } else {
        team.message = `Disk ${team.selectedDisk} is selected. Choose another peg to move it.`;
      }
      render();
      return;
    }

    const source = team.pegs[team.selected];
    const destination = team.pegs[pegIndex];
    const sourceTop = source[source.length - 1];
    const disk = team.selectedDisk ?? sourceTop;
    const destinationTop = destination[destination.length - 1];

    if (disk !== sourceTop) {
      team.selected = null;
      team.selectedDisk = null;
      team.message = "Rule broken - only the top disk can move";
      render();
      return;
    }

    if (destinationTop !== undefined && destinationTop < disk) {
      team.selected = null;
      team.selectedDisk = null;
      team.message = "Rule broken - a larger disk cannot sit on a smaller one";
      render();
      return;
    }

    source.pop();
    destination.push(disk);
    team.moves += 1;
    team.selected = null;
    team.selectedDisk = null;

    const complete = team.pegs[2].length === state.diskCount;
    if (complete) {
      team.finishRemainingMs = Math.max(0, state.deadline - Date.now());
      team.message = `Solved in ${team.moves} moves`;
      if (state.winner === null) {
        state.winner = teamIndex;
      }
    } else {
      team.message = `Move ${team.moves} complete`;
    }

    render();
  }

  function renderTeamCard(team, teamIndex) {
    const card = document.createElement("article");
    card.className = `hanoi-team-card hanoi-team-${teamIndex + 1}`;

    const timeValue = formatTime(team.finishRemainingMs ?? state.remainingMs);
    const teamName = state.teamNames[teamIndex] || `Team ${teamIndex + 1}`;
    const isExpired = state.timeExpired && team.finishRemainingMs === null;

    card.innerHTML = `
      <div class="hanoi-team-head">
        <div>
          <span class="hanoi-team-number">0${teamIndex + 1} / Team</span>
          <input class="hanoi-team-name" value="${escapeHtml(teamName)}" maxlength="24" aria-label="Name for ${escapeHtml(teamName)}"${state.started ? " disabled" : ""}>
        </div>
        <div class="hanoi-timer${isExpired ? " is-expired" : ""}" data-hanoi-timer="${teamIndex}" aria-label="Time left ${timeValue}">
          <span>Time left</span>
          <strong>${timeValue}</strong>
        </div>
      </div>
      <div class="hanoi-board" role="group" aria-label="${escapeHtml(teamName)} board"></div>
      <div class="hanoi-team-status" aria-live="polite">
        <div>
          <span>Moves</span>
          <strong>${String(team.moves).padStart(2, "0")} <small>/ ${optimalMoves()} optimal</small></strong>
        </div>
        <p class="${team.message.startsWith("Rule broken") ? "is-error" : ""}">${escapeHtml(team.message)}</p>
      </div>
    `;

    const nameInput = card.querySelector(".hanoi-team-name");
    nameInput.addEventListener("input", (event) => {
      state.teamNames[teamIndex] = event.target.value;
    });

    const board = card.querySelector(".hanoi-board");
    team.pegs.forEach((peg, pegIndex) => {
      const pegButton = document.createElement("button");
      const isSelected = team.selected === pegIndex;
      pegButton.type = "button";
      pegButton.className = `hanoi-peg-zone${isSelected ? " is-selected" : ""}`;
      pegButton.setAttribute("aria-pressed", String(isSelected));
      pegButton.setAttribute("aria-label", `${teamName}, ${pegNames[pegIndex]} peg, ${peg.length} disks${isSelected ? ", selected" : ""}`);
      pegButton.innerHTML = `
        <span class="hanoi-peg-label">${pegNames[pegIndex]}</span>
        <span class="hanoi-peg">
          <span class="hanoi-post"></span>
          <span class="hanoi-disks"></span>
        </span>
      `;
      pegButton.addEventListener("click", () => selectPeg(teamIndex, pegIndex));

      const diskStack = pegButton.querySelector(".hanoi-disks");
      peg.forEach((disk) => {
        const diskElement = document.createElement("span");
        diskElement.className = `hanoi-disk${isSelected && disk === team.selectedDisk ? " is-active" : ""}`;
        diskElement.style.width = `${34 + (disk / state.diskCount) * 58}%`;
        diskElement.style.setProperty("--disk-index", disk);
        diskElement.title = `Disk ${disk}`;
        diskElement.innerHTML = `<span>${disk}</span>`;
        diskElement.addEventListener("click", (event) => {
          event.stopPropagation();
          selectPeg(teamIndex, pegIndex, disk);
        });
        diskStack.append(diskElement);
      });

      board.append(pegButton);
    });

    return card;
  }

  function updateTimerDisplays() {
    if (!controls.grid) {
      return;
    }

    state.teams.slice(0, state.teamCount).forEach((team, teamIndex) => {
      const timer = controls.grid.querySelector(`[data-hanoi-timer="${teamIndex}"]`);

      if (!timer) {
        return;
      }

      const timeValue = formatTime(team.finishRemainingMs ?? state.remainingMs);
      const isExpired = state.timeExpired && team.finishRemainingMs === null;
      const timerValue = timer.querySelector("strong");

      timer.classList.toggle("is-expired", isExpired);
      timer.setAttribute("aria-label", `Time left ${timeValue}`);

      if (timerValue) {
        timerValue.textContent = timeValue;
      }
    });
  }

  function render() {
    controls.teamButtons.forEach((button) => {
      const isActive = Number(button.dataset.hanoiTeams) === state.teamCount;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

    if (controls.diskSelect) {
      controls.diskSelect.value = String(state.diskCount);
    }

    if (controls.minutesInput) {
      controls.minutesInput.value = String(state.timeLimitMinutes);
    }

    if (controls.startButton) {
      controls.startButton.textContent = state.started
        ? `Restart ${state.teamCount === 1 ? "team" : "both teams"}`
        : "Start challenge";
    }

    setControlsDisabled(state.started);

    if (controls.winnerBanner) {
      if (state.winner !== null) {
        const winnerName = state.teamNames[state.winner] || `Team ${state.winner + 1}`;
        controls.winnerBanner.hidden = false;
        controls.winnerBanner.innerHTML = `<strong>${escapeHtml(winnerName)}</strong> ${state.teamCount === 1 ? "completed the challenge." : "reached the finish first. Let the other team complete the learning journey."}`;
      } else {
        controls.winnerBanner.hidden = true;
        controls.winnerBanner.textContent = "";
      }
    }

    if (controls.timeBanner) {
      controls.timeBanner.hidden = !state.timeExpired;
      controls.timeBanner.innerHTML = state.timeExpired ? "<strong>Time is up.</strong> Start again with the same limit, or choose a new countdown." : "";
    }

    if (controls.grid) {
      controls.grid.classList.toggle("single-team", state.teamCount === 1);
      controls.grid.innerHTML = "";
      state.teams.slice(0, state.teamCount).forEach((team, teamIndex) => {
        controls.grid.append(renderTeamCard(team, teamIndex));
      });
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  controls.teamButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.teamCount = Number(button.dataset.hanoiTeams) === 2 ? 2 : 1;
      resetGame();
    });
  });

  controls.diskSelect?.addEventListener("change", (event) => {
    resetGame(Number(event.target.value));
  });

  controls.minutesInput?.addEventListener("change", (event) => {
    const minutes = Math.min(60, Math.max(1, Math.round(Number(event.target.value)) || 1));
    resetGame(state.diskCount, minutes);
  });

  controls.startButton?.addEventListener("click", startChallenge);
  controls.resetButton?.addEventListener("click", () => resetGame());

  makeTeams();
  render();
})();
