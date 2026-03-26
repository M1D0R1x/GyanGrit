import React from 'react';
import { 
  BarChart3, 
  BookOpen, 
  CheckCircle2, 
  LayoutDashboard, 
  MessageSquare, 
  Bell, 
  User, 
  Trophy, 
  Library, 
  Video, 
  Settings, 
  Edit3, 
  FolderSearch, 
  Users, 
  Key,
  Map,
  Bot
} from 'lucide-react';

export type Role = 'STUDENT' | 'TEACHER' | 'PRINCIPAL' | 'OFFICIAL' | 'ADMIN';

export interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  note?: string;
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

export const getNavGroups = (role: Role): NavGroup[] => {
  const normRole = role.toUpperCase() as Role;

  switch (normRole) {
    case 'STUDENT':
      return [
        {
          group: 'Home',
          items: [
            { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={18} /> },
            { label: 'Profile & Badges', path: '/profile', icon: <User size={18} /> },
            { label: 'Leaderboard', path: '/leaderboard', icon: <Trophy size={18} /> },
            { label: 'Notifications', path: '/notifications', icon: <Bell size={18} /> },
          ],
        },
        {
          group: 'Learning',
          items: [
            { label: 'All Courses', path: '/courses', icon: <Library size={18} /> },
            { label: 'Learning Paths', path: '/learning', icon: <Map size={18} /> },
            { label: 'Flashcards', path: '/flashcards', icon: <BookOpen size={18} /> },
            { label: 'Live Classes', path: '/live', icon: <Video size={18} /> },
            { label: 'AI Tutor', path: '/ai-tutor', icon: <Bot size={18} /> },
          ],
        },
        {
          group: 'Assessments',
          items: [
            { label: 'All Assessments', path: '/assessments', icon: <CheckCircle2 size={18} /> },
            { label: 'Attempt History', path: '/assessments/history', icon: <BarChart3 size={18} /> },
          ],
        },
        {
          group: 'Communication',
          items: [
            { label: 'Class Chat', path: '/chat', icon: <MessageSquare size={18} /> },
            { label: 'Competitions', path: '/competitions', icon: <Trophy size={18} /> },
          ],
        },
      ];

    case 'TEACHER':
      return [
        {
          group: 'Overview',
          items: [
            { label: 'Teacher Dashboard', path: '/teacher', icon: <BarChart3 size={18} /> },
            { label: 'Notifications', path: '/notifications', icon: <Bell size={18} /> },
            { label: 'Profile', path: '/profile', icon: <User size={18} /> },
          ],
        },
        {
          group: 'Classes & Content',
          items: [
            { label: 'Class Detail', path: '/teacher', icon: <Library size={18} />, note: 'Select from dashboard' },
            { label: 'Gradebook', path: '/teacher', icon: <Edit3 size={18} />, note: 'Dashboard → Class' },
            { label: 'Lesson Editor', path: '/teacher', icon: <Edit3 size={18} />, note: 'Course Card → Edit' },
          ],
        },
        {
          group: 'Staff & Codes',
          items: [
            { label: 'Join Codes', path: '/teacher/users', icon: <Key size={18} /> },
          ],
        },
        {
          group: 'Communication',
          items: [
            { label: 'Class Chat', path: '/teacher/chat', icon: <MessageSquare size={18} /> },
            { label: 'Live Classes', path: '/teacher/live', icon: <Video size={18} /> },
          ],
        },
      ];

    case 'PRINCIPAL':
      return [
        {
          group: 'Overview',
          items: [
            { label: 'Dashboard', path: '/principal', icon: <Library size={18} /> },
            { label: 'Notifications', path: '/notifications', icon: <Bell size={18} /> },
          ],
        },
        {
          group: 'Staff & Governance',
          items: [
            { label: 'Join Codes', path: '/principal/users', icon: <Key size={18} /> },
            { label: 'Institutional Chat', path: '/principal/chat', icon: <MessageSquare size={18} /> },
          ],
        },
      ];

    case 'OFFICIAL':
      return [
        {
          group: 'Governance',
          items: [
            { label: 'Official Dashboard', path: '/official', icon: <Map size={18} /> },
            { label: 'Manage Codes', path: '/official/users', icon: <Key size={18} /> },
          ],
        },
      ];

    case 'ADMIN':
      return [
        {
          group: 'System',
          items: [
            { label: 'Admin Panel', path: '/admin-panel', icon: <Settings size={18} /> },
            { label: 'User Directory', path: '/admin/users', icon: <Users size={18} /> },
            { label: 'System Chat', path: '/admin/chat-management', icon: <MessageSquare size={18} /> },
          ],
        },
        {
          group: 'Institutional Content',
          items: [
            { label: 'Manage Courses', path: '/admin/content', icon: <Library size={18} /> },
            { label: 'Global Codes', path: '/admin/join-codes', icon: <Key size={18} /> },
          ],
        },
      ];

    default:
      return [];
  }
};
