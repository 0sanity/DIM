import { ReactStateDeclaration } from '@uirouter/react';

export const whatsNewState: ReactStateDeclaration = {
  name: 'whats-new.**',
  url: '/whats-new',
  lazyLoad: async() => {
    const module = await import('./WhatsNew');
    return {
      states: [{
        name: 'whats-new',
        url: whatsNewState.url,
        component: module.default
      }]
    };
  }
};
