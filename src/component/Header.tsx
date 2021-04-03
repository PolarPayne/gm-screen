import styles from "./Header.module.css";
import { useSpaceId } from "store";
import Link from "next/link";

export const Header: React.FC = () => {
  const [spaceId, setSpaceId] = useSpaceId<string>();

  return (
    <div className={styles.header}>
      <Link href="/">
        <a className={styles.title}>GM Screen</a>
      </Link>
      <Link href="/item">Items</Link>
      <Link href="/asset">Assets</Link>
      <label>
        Space ID:{" "}
        <input
          className={styles.spaceSelector}
          value={spaceId}
          onChange={(ev) => setSpaceId(ev.target.value)}
        />
      </label>
    </div>
  );
};
