"""Regenerate with Python + NumPy; runtime/tests do not require Python."""
import json
from pathlib import Path
import numpy as np

maze = np.array([[0,0,0,1,0],[1,1,0,1,0],[0,0,0,0,0],[0,1,1,1,0],[0,0,0,1,0]])
actions = [(-1,0),(1,0),(0,-1),(0,1)]

def run(seed, initial_q, rewards, episodes):
    rng = np.random.RandomState(seed)
    q = np.full((5,5,4), initial_q, dtype=float)
    epsilon = 1.0
    lengths, returns, first_actions = [], [], []
    for episode in range(episodes):
        state, total = (0,0), 0
        for t in range(100):
            if rng.rand() < epsilon:
                action = int(rng.randint(4))
            else:
                values = q[state]
                action = int(rng.choice(np.flatnonzero(values == values.max())))
            if len(first_actions) < 40:
                first_actions.append(action)
            nr, nc = state[0]+actions[action][0], state[1]+actions[action][1]
            if nr<0 or nr>=5 or nc<0 or nc>=5 or maze[nr,nc]:
                next_state, reward, done = state, rewards[2], False
            else:
                next_state, done = (nr,nc), (nr,nc)==(4,4)
                reward = rewards[1] if done else rewards[0]
            future = 0 if done else np.max(q[next_state])
            q[state][action] += 0.1 * (reward + 0.9 * future - q[state][action])
            state = next_state
            total += reward
            if done:
                break
        epsilon = max(0.01, epsilon * 0.99)
        lengths.append(t+1)
        returns.append(total)
    return dict(seed=seed, initialQ=initial_q, stepReward=rewards[0], goalReward=rewards[1],
                wallReward=rewards[2], episodes=episodes, q=q.tolist(),
                lengths=lengths, returns=returns, firstActions=first_actions, epsilon=epsilon)

fixture = {'numpy': np.__version__, 'runs': [run(42, 0.0, (-1,10,-5), 500),
            run(7, -1.0, (-0.25,12.5,-2.75), 60)]}
Path(__file__).with_name('maze-reference.json').write_text(json.dumps(fixture, indent=2), encoding='utf-8')
