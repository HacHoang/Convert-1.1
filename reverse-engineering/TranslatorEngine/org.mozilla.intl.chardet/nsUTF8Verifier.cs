namespace org.mozilla.intl.chardet;

public class nsUTF8Verifier : nsVerifier
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

	public nsUTF8Verifier()
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
		m_cclass[8] = 286331153;
		m_cclass[9] = 286331153;
		m_cclass[10] = 286331153;
		m_cclass[11] = 286331153;
		m_cclass[12] = 286331153;
		m_cclass[13] = 286331153;
		m_cclass[14] = 286331153;
		m_cclass[15] = 286331153;
		m_cclass[16] = 858989090;
		m_cclass[17] = 1145324612;
		m_cclass[18] = 1145324612;
		m_cclass[19] = 1145324612;
		m_cclass[20] = 1431655765;
		m_cclass[21] = 1431655765;
		m_cclass[22] = 1431655765;
		m_cclass[23] = 1431655765;
		m_cclass[24] = 1717986816;
		m_cclass[25] = 1717986918;
		m_cclass[26] = 1717986918;
		m_cclass[27] = 1717986918;
		m_cclass[28] = -2004318073;
		m_cclass[29] = -2003269496;
		m_cclass[30] = -1145324614;
		m_cclass[31] = 16702940;
		m_states = new int[26];
		m_states[0] = -1408167679;
		m_states[1] = 878082233;
		m_states[2] = 286331153;
		m_states[3] = 286331153;
		m_states[4] = 572662306;
		m_states[5] = 572662306;
		m_states[6] = 290805009;
		m_states[7] = 286331153;
		m_states[8] = 290803985;
		m_states[9] = 286331153;
		m_states[10] = 293041937;
		m_states[11] = 286331153;
		m_states[12] = 293015825;
		m_states[13] = 286331153;
		m_states[14] = 295278865;
		m_states[15] = 286331153;
		m_states[16] = 294719761;
		m_states[17] = 286331153;
		m_states[18] = 298634257;
		m_states[19] = 286331153;
		m_states[20] = 297865489;
		m_states[21] = 286331153;
		m_states[22] = 287099921;
		m_states[23] = 286331153;
		m_states[24] = 285212689;
		m_states[25] = 286331153;
		m_charset = "UTF-8";
		m_stFactor = 16;
	}

	public override bool isUCS2()
	{
		return false;
	}
}
