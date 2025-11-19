import { useHotkeys } from 'react-hotkeys-hook';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';

export function GlobalHotkeys({ onRunSimulation }) {
  const navigate = useNavigate();

  // Navigation shortcuts: G + [letter]
  useHotkeys('g+h', () => navigate('/'), { preventDefault: true });
  useHotkeys('g+p', () => navigate('/planning'), { preventDefault: true });
  useHotkeys('g+f', () => navigate('/forecast'), { preventDefault: true });
  useHotkeys('g+l', () => navigate('/logistics'), { preventDefault: true });
  useHotkeys('g+s', () => navigate('/settings'), { preventDefault: true });

  // Actions
  useHotkeys('ctrl+r,meta+r', (e) => {
    e.preventDefault();
    onRunSimulation?.();
  }, { preventDefault: true });

  return null; // Headless component
}

GlobalHotkeys.propTypes = {
  onRunSimulation: PropTypes.func,
};

