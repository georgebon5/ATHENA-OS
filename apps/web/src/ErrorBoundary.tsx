import { Component, type ReactNode } from "react";

interface Props {
  name: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Απομονώνει κάθε layer/πάνελ. Αν σπάσει ένα, δεν γκρεμίζει όλη την
 * οθόνη — απλώς δεν σχεδιάζεται και γράφουμε στο console. Κρίσιμο στο
 * demo: προτιμάμε να χάσουμε 1 feature παρά να μείνει άσπρη οθόνη.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    console.error(`[boundary:${this.props.name}]`, error);
  }

  render(): ReactNode {
    if (this.state.error) return null;
    return this.props.children;
  }
}
