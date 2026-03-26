interface SectionTransitionProps {
  from?: "dark" | "light";
  to?: "dark" | "light";
}

const SectionTransition = ({}: SectionTransitionProps) => {
  return <div className="h-0" />;
};

export default SectionTransition;
