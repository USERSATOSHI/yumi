
import { NavLink } from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';
import ListAltIcon from '@mui/icons-material/ListAlt';
import AccessAlarmIcon from '@mui/icons-material/AccessAlarm';
import SettingsRemoteIcon from '@mui/icons-material/SettingsRemote';
import DevicesIcon from '@mui/icons-material/Devices';
import './index.css';

export default function BottomMenu() {
  return (
    <nav className="bottom-menu">
      <NavLink to="/devices" title="Devices"><DevicesIcon fontSize="medium" /></NavLink>
      <NavLink to="/control" title="Control"><SettingsRemoteIcon fontSize="medium" /></NavLink>
      <NavLink to="/" end title="Home"><HomeIcon fontSize="medium" /></NavLink>
      <NavLink to="/todos" title="Todos"><ListAltIcon fontSize="medium" /></NavLink>
      <NavLink to="/reminders" title="Reminders"><AccessAlarmIcon fontSize="medium" /></NavLink>
    </nav>
  );
}
