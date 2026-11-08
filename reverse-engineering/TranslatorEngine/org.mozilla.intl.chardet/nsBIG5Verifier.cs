namespace org.mozilla.intl.chardet;

public class nsBIG5Verifier : nsVerifier
{
	private static int[] m_cclass;

	private static int[] m_states;

	private static int m_stFactor;

	private static string m_charset;

	public override int[] cclass()
	{
		return m_cclass;
	}

	public override int[] states()
	{
		return m_states;
	}

	public override int stFactor()
	{
		return m_stFactor;
	}

	public override string charset()
	{
		return m_charset;
	}

	public nsBIG5Verifier()
	{
		m_cclass = new int[32];
		m_cclass[0] = 286331153;
		m_cclass[1] = 1118481;
		m_cclass[2] = 286331153;
		m_cclass[3] = 286327057;
		m_cclass[4] = 286331153;
		m_cclass[5] = 286331153;
		m_cclass[6] = 286331153;
		m_cclass[7] = 286331153;
		m_cclass[8] = 572662306;
		m_cclass[9] = 572662306;
		m_cclass[10] = 572662306;
		m_cclass[11] = 572662306;
		m_cclass[12] = 572662306;
		m_cclass[13] = 572662306;
		m_cclass[14] = 572662306;
		m_cclass[15] = 304226850;
		m_cclass[16] = 1145324612;
		m_cclass[17] = 1145324612;
		m_cclass[18] = 1145324612;
		m_cclass[19] = 1145324612;
		m_cclass[20] = 858993460;
		m_cclass[21] = 858993459;
		m_cclass[22] = 858993459;
		m_cclass[23] = 858993459;
		m_cclass[24] = 858993459;
		m_cclass[25] = 858993459;
		m_cclass[26] = 858993459;
		m_cclass[27] = 858993459;
		m_cclass[28] = 858993459;
		m_cclass[29] = 858993459;
		m_cclass[30] = 858993459;
		m_cclass[31] = 53687091;
		m_states = new int[3];
		m_states[0] = 286339073;
		m_states[1] = 304226833;
		m_states[2] = 1;
		m_charset = "Big5";
		m_stFactor = 5;
	}

	public override bool isUCS2()
	{
		return false;
	}
}
