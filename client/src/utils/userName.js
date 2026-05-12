export function firstName(user) {
  return user?.name?.split(' ')[0] || 'Your'
}
