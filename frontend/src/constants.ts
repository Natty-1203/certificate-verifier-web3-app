export const DEPARTMENTS = [
  'Electrical and Computer Engineering',
  'Software Engineering',
  'Civil Engineering',
  'Chemical Engineering',
  'Mechanical Engineering',
  'Computer Science and Engineering',
  'Information Technology',
  'Computer Engineering',
  'Electronics and Communication Engineering',
  'Power Systems Engineering',
  'Control and Instrumentation Engineering',
  'Industrial Engineering',
  'Production Engineering',
  'Materials Science and Engineering',
  'Environmental Engineering',
  'Water Resources Engineering',
  'Architecture and Urban Planning',
  'Construction Technology and Management',
  'Surveying and Geomatics Engineering',
  'Biomedical Engineering',
  'Food Engineering',
  'Biotechnology',
  'Textile Engineering',
  'Leather Engineering',
  'Applied Mathematics',
  'Applied Physics',
  'Applied Chemistry',
  'Applied Statistics',
  'Agricultural Engineering',
  'Hydrology and Water Management',
] as const;

const currentYear = new Date().getFullYear();

export function getGraduationYears(): string[] {
  const years: string[] = [];
  for (let y = currentYear + 5; y >= 2000; y--) {
    years.push(String(y));
  }
  return years;
}
