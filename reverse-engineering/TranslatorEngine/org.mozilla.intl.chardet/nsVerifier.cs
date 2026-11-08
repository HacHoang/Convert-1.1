namespace org.mozilla.intl.chardet;

public abstract class nsVerifier
{
	public const byte eStart = 0;

	public const byte eError = 1;

	public const byte eItsMe = 2;

	public const int eidxSft4bits = 3;

	public const int eSftMsk4bits = 7;

	public const int eBitSft4bits = 2;

	public const int eUnitMsk4bits = 15;

	public nsVerifier()
	{
	}

	public abstract string charset();

	public abstract int stFactor();

	public abstract int[] cclass();

	public abstract int[] states();

	public abstract bool isUCS2();

	public static byte getNextState(nsVerifier v, byte b, byte s)
	{
		return (byte)(0xFF & ((v.states()[((s * v.stFactor() + ((v.cclass()[(b & 0xFF) >> 3] >> ((b & 7) << 2)) & 0xF)) & 0xFF) >> 3] >> (((s * v.stFactor() + ((v.cclass()[(b & 0xFF) >> 3] >> ((b & 7) << 2)) & 0xF)) & 0xFF & 7) << 2)) & 0xF));
	}
}
